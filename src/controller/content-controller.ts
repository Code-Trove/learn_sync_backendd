import { Request, Response } from "express";
import { PrismaClient, ContentType, Prisma, Content } from "@prisma/client";
import { generateUniqueLink } from "../utils/generate-link";
import { processContent } from "../utils/content-processor";
import {
  generateContentEmbedding,
  generateEmbedding,
} from "../utils/embeddings";

import { GoogleGenerativeAI } from "@google/generative-ai";

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

interface QuickCaptureOptions {
  instantSave: boolean;
  autoTagging: boolean;
  contextPreservation: boolean;
  sharingOptions: boolean;
}

interface AuthRequest extends Request {
  user: {
    id: number;
  };
}
type User = {
  id: number;
};
export const addContent = async (req: Request, res: Response): Promise<any> => {
  try {
    const { type, title, tags, link, extractedText } = req.body;
    console.log("Request body:", req.body);

    const user = req.user as User;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
    }

    const processedContent = extractedText
      ? {
          extractedText,
          keywords: tags,
          metadata: {
            author: "",
            duration: 0,
            publishDate: new Date(),
          },
        }
      : await processContent(link, type);

    // Generate and validate embedding
    const embedding = await generateContentEmbedding({
      title,
      extractedText: processedContent.extractedText,
      keywords: processedContent.keywords,
    });

    // Validate embedding values
    const validEmbedding = embedding.map((value) => {
      if (isNaN(value)) return 0;
      return value;
    });

    // Create content first
    const content = await prisma.content.create({
      data: {
        link,
        type,
        title,
        extractedText: processedContent.extractedText,
        metadata: processedContent.metadata,
        keywords: processedContent.keywords,
        duration: processedContent.metadata.duration || 0,
        author: processedContent.metadata.author || "",
        publishedAt: processedContent.metadata.publishDate || new Date(),
        userId: user.id as number,
        tags: {
          create: tags.map((tagTitle: string) => ({
            tag: {
              connectOrCreate: {
                where: { title: tagTitle.toLowerCase() },
                create: { title: tagTitle.toLowerCase() },
              },
            },
          })),
        },
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    // Update embedding with validated values
    await prisma.$executeRaw`
      UPDATE "Content"
      SET embedding = ${`[${validEmbedding.join(",")}]`}::vector
      WHERE id = ${content.id}
    `;

    // Fetch updated content
    const updatedContent = await prisma.content.findUnique({
      where: { id: content.id },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });
    console.log("Content created successfully", updatedContent);
    return res.status(201).json({
      success: true,
      data: updatedContent,
      message: "Content created successfully",
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
};

export const getAllContent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.query.userId ? Number(req.query.userId) : undefined;

    const where: Prisma.ContentWhereInput = userId ? { userId } : {};

    const findAllContent = await prisma.content.findMany({
      where,
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!findAllContent.length) {
      res.json({
        message: "No content available",
        data: [],
        success: true,
      });
      return;
    }

    res.status(200).json({
      message: "Content fetched successfully",
      data: findAllContent,
      success: true,
    });
  } catch (error) {
    const err = error as Error;
    console.error(err.message);
    res.status(500).json({
      message: "Internal server error",
      success: false,
      error: err.message,
    });
  }
};

export const shareWithUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { contentId, targetUserId } = req.body as {
      contentId: number;
      targetUserId: number;
    };
    const userId = Number(req.body.userId);

    const linkData: Prisma.LinkCreateInput = {
      hash: generateUniqueLink(),
      user: {
        connect: { id: targetUserId },
      },
      content: {
        connect: { id: contentId },
      },
    };

    const link = await prisma.link.create({
      data: linkData,
    });

    const shareLink = `${
      process.env.BASE_URL || "http://localhost:3125"
    }/api/v1/shared/${link.hash}`;

    res.status(200).json({
      message: "Content shared successfully with user",
      data: {
        sharedWith: targetUserId,
        shareLink,
      },
      success: true,
    });
  } catch (error) {
    console.error("Error in shareWithUser:", error);
    res.status(500).json({
      message: "Internal server error",
      success: false,
      error: (error as Error).message,
    });
  }
};

export const makeContentPublic = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const contentId = Number(req.body.contentId);
    const userId = Number(req.body.userId);

    const content = await prisma.content.findFirst({
      where: {
        id: contentId,
        userId,
      },
    });

    if (!content) {
      res.status(404).json({
        message: "Content not found",
        success: false,
      });
      return;
    }

    const updatedContent = await prisma.content.update({
      where: { id: contentId },
      data: { share: true },
    });

    const publicLink = `${
      process.env.BASE_URL || "http://localhost:3125"
    }/api/v1/shared/${updatedContent.link}`;

    res.status(200).json({
      message: "Content is now public",
      data: {
        publicLink,
      },
      success: true,
    });
  } catch (error) {
    console.error("Error in makeContentPublic:", error);
    res.status(500).json({
      message: "Internal server error",
      success: false,
      error: (error as Error).message,
    });
  }
};

export const makeContentPrivate = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const contentId = Number(req.body.contentId);
    const userId = Number(req.body.userId);

    const content = await prisma.content.findFirst({
      where: {
        id: contentId,
        userId,
      },
    });

    if (!content) {
      res.status(404).json({
        message: "Content not found",
        success: false,
      });
      return;
    }

    await prisma.$transaction([
      prisma.content.update({
        where: { id: contentId },
        data: { share: false },
      }),
      prisma.link.deleteMany({
        where: { contentId },
      }),
    ]);

    res.status(200).json({
      message: "Content is now private",
      success: true,
    });
  } catch (error) {
    console.error("Error in makeContentPrivate:", error);
    res.status(500).json({
      message: "Internal server error",
      success: false,
      error: (error as Error).message,
    });
  }
};

export const accessSharedContent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { hash } = req.params;

    const link = await prisma.link.findFirst({
      where: { hash },
      include: {
        content: {
          include: {
            tags: {
              include: {
                tag: true,
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (link) {
      res.status(200).json({
        message: "Shared content fetched successfully",
        data: link.content,
        success: true,
      });
      return;
    }

    const publicContent = await prisma.content.findFirst({
      where: {
        link: hash,
        share: true,
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!publicContent) {
      res.status(404).json({
        message: "Content not found or access denied",
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: "Public content fetched successfully",
      data: publicContent,
      success: true,
    });
  } catch (error) {
    console.error("Error in accessSharedContent:", error);
    res.status(500).json({
      message: "Internal server error",
      success: false,
      error: (error as Error).message,
    });
  }
};

export const searchContent = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== "string" || query.trim() === "") {
      return res.status(400).json({
        message: "Invalid search query",
        success: false,
      });
    }

    const user = req.user as User;

    const userId = user.id;

    const contents = await prisma.content.findMany({
      where: {
        userId,
        type: "TEXT",
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { extractedText: { contains: query, mode: "insensitive" } },
          { author: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        topics: true,
        summaries: true,
        tags: { include: { tag: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    if (contents.length === 0) {
      return res.status(404).json({
        message: "No content found matching the query.",
        success: false,
      });
    }

    console.log("Search results:", contents);

    return res.status(200).json({
      message: "Search results retrieved successfully.",
      data: contents,
      success: true,
    });
  } catch (error: any) {
    console.error("Error during search:", error);
    return res.status(500).json({
      message: "Internal server error",
      success: false,
      error: error.message,
    });
  }
};

export const contentChat = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { question, content, pageContext, sourceUrl } = req.body;
    if (!content || !question || !pageContext || !sourceUrl) {
      res.status(400).json({
        success: false,
        error:
          "Content, question, page context, and source URL must be provided",
      });
      return;
    }
    const isGreeting =
      /\b(hi+|hello+|hey+|greet+|yo+|hlw+|hii+|hola+|sup)\b/i.test(question);

    // Handle initial greeting response
    if (isGreeting) {
      res.status(200).json({
        success: true,
        response:
          "Hello! 😊 Do you have a specific question, or would you like me to explain the content in detail? Let me know how I can assist you better!",
      });
      return;
    }

    const affirmativeResponses = ["yes", "sure", "go ahead", "explain", "okay"];
    if (affirmativeResponses.includes(question.toLowerCase())) {
      res.status(200).json({
        success: true,
        response: `
        Certainly! Here's a detailed explanation based on the provided content:
        "${content}"
        
        I'll break it down with real-world examples, practical applications, and analogies to ensure clarity. If you have further questions, feel free to ask! 😊
      `,
      });
      return;
    }
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `
              Full Page Context: "${pageContext}"
              Source URL: "${sourceUrl}"
              
              Content for analysis: "${content}"
              
              User's Question: "${question}"
              
              Answer the user's question directly with a detailed explanation. If the question is unclear, politely ask for clarification. If the question is related to the content, explain thoroughly using real-world analogies, practical examples, and references for clarity.
              
              After answering, ask the user:
              "Would you like to move to the next topic or deep dive into this topic?"
            `,
            },
          ],
        },
      ],
    };
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );
    console.log("Gemini API response status:", response);

    const data = await response.json();
    console.log(
      "Full response from Gemini API:",
      JSON.stringify(data, null, 2)
    );

    if (data.candidates && data.candidates.length > 0) {
      const candidateContent =
        data.candidates[0].content?.parts[0]?.text || "No valid content found.";
      res.status(200).json({
        success: true,
        response: candidateContent,
      });
    } else {
      res.status(400).json({
        success: false,
        error: "Gemini API returned no valid candidates",
      });
    }
  } catch (error) {
    console.error("Chat processing failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process chat, please try again later.",
    });
  }
};

export const contentSummarization = async (req: Request, res: Response) => {
  try {
    const { content, discussion } = req.body;

    const summaryPrompt = {
      contents: [
        {
          parts: [
            {
              text: `Summarize this content and discussion into a clear, engaging format.
                Content: ${content}
                Discussion: ${JSON.stringify(discussion)}
                
                Requirements:
                - Create a concise summary
                - Focus on key points
                - Use professional tone
                - Avoid mentioning user interactions or discussions
                - Avoid technical jargon
                - Make it readable and shareable
                - Focus only on relevant information from the content
                
                Format the response as plain text without any special formatting.`,
            },
          ],
        },
      ],
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(summaryPrompt),
      }
    );

    const data = await response.json();

    // Extract clean text from Gemini response
    const summaryText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!summaryText) {
      throw new Error("Failed to generate summary");
    }

    res.status(200).json({
      success: true,
      summary: summaryText,
    });
  } catch (error) {
    console.error("Summary generation failed:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate summary",
    });
  }
};
