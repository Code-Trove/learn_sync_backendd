import { Request, Response } from "express";
import { contentBody } from "../zod/content-zod";
import { PrismaClient, ContentType, Prisma, Content } from "@prisma/client";
import { generateUniqueLink } from "../utils/generate-link";
import { processContent } from "../utils/content-processor";
import {
  generateContentEmbedding,
  generateEmbedding,
} from "../utils/embeddings";
import {
  generateContentSummary,
  SummaryStyle,
} from "../utils/summary-generator";
import { craftPlatformPost } from "../utils/post-crafter";
import { GoogleGenerativeAI } from "@google/generative-ai";

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export const addContent = async (req: Request, res: Response): Promise<any> => {
  try {
    const { type, title, userId, tags, link, extractedText } = req.body;

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      // Create default user if not exists
      const newUser = await prisma.user.create({
        data: {
          id: userId,
          email: `user${userId}@example.com`, // temporary email
          name: `User ${userId}`,
          password: "defaultpassword", // should be hashed in production
        },
      });
    }

    // Process content
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
        userId,
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
): Promise<void> => {
  try {
    const { query, type, userId } = req.query;

    // If there's a search query, generate its embedding
    let embedding = null;
    if (query) {
      embedding = await generateEmbedding(query as string);
    }

    const where: Prisma.ContentWhereInput = {
      AND: [
        userId ? { userId: Number(userId) } : {},
        type ? { type: type as ContentType } : {},
      ],
    };

    // If we have an embedding, use vector similarity search
    const contents = await prisma.$queryRaw`
      SELECT c.*, 
             1 - (c.embedding <=> ${embedding}::vector) as similarity
      FROM "Content" c
      WHERE ${where}
      ORDER BY similarity DESC
      LIMIT 20
    `;

    res.status(200).json({
      message: "Search results retrieved successfully",
      data: contents,
      success: true,
    });
  } catch (error) {
    console.error("Error in searchContent:", error);
    res.status(500).json({
      message: "Internal server error",
      success: false,
      error: (error as Error).message,
    });
  }
};

export const generateSummary = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { contentId } = req.params;
    const { style = "professional" } = req.query;

    // Get content with its embedding
    interface ContentWithEmbedding {
      id: number;
      title: string;
      extractedText: string;
      metadata: any;
      keywords: string[];
      embedding: number[];
      tags: any[];
    }

    const content = await prisma.$queryRaw<ContentWithEmbedding[]>`
      SELECT 
        c.id,
        c.title,
        c.extracted_text as "extractedText",
        c.metadata,
        c.keywords,
        c.embedding,
        json_agg(json_build_object('tag', t.*)) as tags
      FROM "Content" c
      LEFT JOIN "TagsOnContents" tc ON c.id = tc.content_id
      LEFT JOIN "Tag" t ON tc.tag_id = t.id
      WHERE c.id = ${Number(contentId)}
      GROUP BY c.id
    `;

    if (!content[0]) {
      res.status(404).json({
        message: "Content not found",
        success: false,
      });
      return;
    }

    // Generate summary
    const summary = await generateContentSummary(
      {
        title: content[0].title,
        extractedText: content[0].extractedText || "",
        metadata: content[0].metadata,
        keywords: content[0].keywords,
      },
      style as SummaryStyle
    );

    // Find related content using embeddings
    const relatedContent = await prisma.$queryRaw`
      SELECT c.id, c.title, 
             1 - (c.embedding <=> ${content[0].embedding}::vector) as similarity
      FROM "Content" c
      WHERE c.id != ${content[0].id}
      ORDER BY similarity DESC
      LIMIT 5
    `;

    // Add chat functionality
    const chatContext = {
      title: content[0].title,
      summary: summary.tldr,
      keyPoints: summary.keyPoints,
    };

    // Generate platform-specific posts
    const posts = await Promise.all([
      craftPlatformPost(
        {
          summary: summary.tldr,
          keyPoints: summary.keyPoints,
          learnings: "What I learned from this content", // User can customize this
        },
        "linkedin"
      ),
      craftPlatformPost(
        {
          summary: summary.tldr,
          keyPoints: summary.keyPoints,
          learnings: "Key takeaway",
        },
        "twitter",
        "thread"
      ),
    ]);

    res.status(200).json({
      message: "Summary generated successfully",
      data: {
        summary,
        relatedContent,
        chatContext,
        socialPosts: {
          linkedin: posts[0],
          twitter: posts[1],
        },
      },
      success: true,
    });
  } catch (error) {
    console.error("Error generating summary:", error);
    res.status(500).json({
      message: "Internal server error",
      success: false,
      error: (error as Error).message,
    });
  }
};

// Add a new endpoint for continuing the chat
export const chatWithContent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { contentId } = req.params;
    const { message, context } = req.body;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `You are an expert discussing: ${context.title}. 
                   You have deep knowledge of this content and can answer questions about it.
                   Summary: ${context.summary}
                   Key Points: ${context.keyPoints.join(", ")}
                   
                   User Question: ${message}`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const response = result.response;
    const text = response.text();

    res.status(200).json({
      message: "Chat response generated",
      data: {
        response: text,
      },
      success: true,
    });
  } catch (error) {
    console.error("Error in chat:", error);
    res.status(500).json({
      message: "Internal server error",
      success: false,
      error: (error as Error).message,
    });
  }
};

// Clean up Prisma connection on server shutdown
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});
