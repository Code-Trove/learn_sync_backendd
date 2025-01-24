import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import cheerio from "cheerio";
import { craftPlatformPost, Platform } from "../utils/post-crafter";
import { chromium, Browser, Page } from "playwright";
import { processLargePdfFromUrl } from "../utils/pdf-parser";
import { analyzeImage } from "../utils/analyzeImage";
import { ImageAnalysisResult } from "../types/types";
import { generateEmbedding } from "../utils/generateEmbedding";
import { storeInPinecone } from "../utils/generateEmbedding";
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
    // other user properties...
  };
}

export const captureContext = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { sourceUrl, selectedText, pageContext, userThought, contentId } =
      req.body;

    const prompt = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `
            URL: ${sourceUrl}
            Selected Text: ${selectedText}
            Page Context: ${pageContext}
            User's Thought: ${userThought}

            Please analyze this context and provide:
            1. Key concepts mentioned
            2. Related topics
            3. Potential learning paths
          `,
            },
          ],
        },
      ],
    };

    const result = await model.generateContent(prompt);
    const enhancedContext = result.response.text();

    const context = await prisma.contentContext.create({
      data: {
        sourceUrl,
        selectedText,
        pageContext,
        userThought,
        content: {
          connect: { id: contentId },
        },
      },
    });

    res.status(201).json({
      message: "Context captured successfully",
      data: {
        context,
        enhancement: enhancedContext,
      },
      success: true,
    });
  } catch (error) {
    console.error("Error capturing context:", error);
    res.status(500).json({
      message: "Error capturing context",
      success: false,
      error: (error as Error).message,
    });
  }
};

export const getContextsForContent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { contentId } = req.params;

    const contexts = await prisma.contentContext.findMany({
      where: {
        contentId: Number(contentId),
      },
      orderBy: {
        captureTime: "desc",
      },
    });

    res.status(200).json({
      message: "Contexts retrieved successfully",
      data: contexts,
      success: true,
    });
  } catch (error) {
    console.error("Error retrieving contexts:", error);
    res.status(500).json({
      message: "Error retrieving contexts",
      success: false,
      error: (error as Error).message,
    });
  }
};
const handleResponse = (
  res: Response,
  data: any,
  message: string,
  status = 200
) => {
  res.status(status).json({
    message,
    success: status < 400,
    data,
  });
};

// Metadata extraction for a URL
export const extractMetadata = async (url: string) => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    if (url.endsWith(".pdf")) {
      console.log("PDF URL detected, processing with Gemini...");
      const metadata = await processLargePdfFromUrl(url);
      return {
        success: true,
        message: "PDF metadata extracted successfully",
        data: metadata,
      };
    }
    if (url.includes("x.com")) {
      console.log("Twitter URL detected, extracting tweet metadata...");
      const tweetMetadata = await extractTweetMetadata(url);
      return {
        success: true,
        message: "Tweet metadata extracted successfully",
        data: tweetMetadata,
      };
    }
    await page.goto(url, { timeout: 30000, waitUntil: "domcontentloaded" });

    // Try to extract metadata first
    const metadata = await page.evaluate(() => {
      // Check if the title element is an HTMLElement
      const titleElement = document.querySelector("title");
      const title =
        titleElement instanceof HTMLElement
          ? titleElement.innerText
          : "Untitled";

      const descriptionMeta = document.querySelector(
        'meta[name="description"]'
      ) as HTMLMetaElement;
      const description =
        descriptionMeta?.getAttribute("content") || "No description available.";

      const imageMeta = document.querySelector(
        'meta[property="og:image"]'
      ) as HTMLMetaElement;
      const image = imageMeta?.getAttribute("content") || "No image available.";

      return { title, description, image };
    });
    console.log("Metadata:", metadata);
    // If metadata exists, return it
    if (
      metadata.title.trim().toLowerCase() !== "untitled" ||
      (metadata.description.trim() !== "No description available." &&
        metadata.image.trim() !== "No image available.")
    ) {
      return {
        success: true,
        message: "Metadata extracted successfully",
        data: metadata,
      };
    } else {
      // Fallback: If metadata isn't available, extract content
      const content = await extractContent(url);
      return {
        success: true,
        message: "Metadata extracted successfully with fallback",
        data: {
          title: content.title || "Untitled",
          description: content.description || "No description available.",
          image: content.image || "No image available.",
        },
      };
    }
  } catch (error: any) {
    console.error("Error extracting metadata:", error);
    return {
      success: false,
      message: "Error extracting metadata",
      error: error.message,
    };
  } finally {
    await browser.close();
  }
};

// Fallback content extraction (e.g., from social media posts like Twitter/X)
interface ExtractedContent {
  title: string;
  description: string;
  image: string;
  author: string;
  timestamp: string;
}

/**
 * Retry logic for any async operation.
 * @param fn - The async function to retry.
 * @param retries - Number of retries.
 */
const retry = async (
  fn: () => Promise<void>,
  retries: number
): Promise<void> => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await fn();
      return;
    } catch (error) {
      if (attempt === retries - 1) {
        throw error;
      }
      console.log(`Retry ${attempt + 1} failed, retrying...`);
    }
  }
};

/**
 * Extract content from a given URL.
 * @param url - The URL of the page to extract content from.
 * @returns A promise that resolves to the extracted content.
 */
export const extractContent = async (
  url: string
): Promise<ExtractedContent> => {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch(); // Launch the browser
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      viewport: { width: 1280, height: 720 },
    });
    const page: Page = await context.newPage();

    console.log("Inside extractContent");

    await retry(async () => {
      await page.goto(url, { timeout: 30000, waitUntil: "domcontentloaded" });
    }, 3);

    const content: ExtractedContent = await page.evaluate(() => {
      const postTextElement = document.querySelector("article");
      const postText =
        postTextElement instanceof HTMLElement
          ? postTextElement.innerText
          : "No content available";

      // Extract the author name
      const authorElement = document.querySelector("div[role='article'] span");
      const author =
        authorElement instanceof HTMLElement
          ? authorElement.innerText
          : "Unknown author";

      const timestampElement = document.querySelector("time");
      const timestamp = timestampElement
        ? timestampElement.getAttribute("datetime") ?? "Unknown time"
        : "Unknown time";

      return {
        title: postText.substring(0, 100),
        description: postText,
        image: "No image available",
        author,
        timestamp,
      };
    });

    return content;
  } catch (error) {
    console.error("Error extracting content:", error);

    // Return fallback content in case of error
    return {
      title: "Untitled",
      description: "No description available.",
      image: "No image available.",
      author: "Unknown author",
      timestamp: "Unknown time",
    };
  } finally {
    if (browser) {
      await browser.close(); // Ensure the browser is closed
    }
  }
};

interface TweetMetadata {
  title: string;
  description: string;
  author: string;
  timestamp: string;
  image: string | null;
}
const extractTweetMetadata = async (url: string): Promise<TweetMetadata> => {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      viewport: { width: 1280, height: 720 },
    });
    const page: Page = await context.newPage();

    await page.goto(url, { timeout: 30000, waitUntil: "domcontentloaded" });
    await page.waitForSelector("article", { timeout: 10000 });

    const metadata: TweetMetadata = await page.evaluate(() => {
      const tweetTextElement = document.querySelector("article div[lang]");
      const tweetText =
        tweetTextElement instanceof HTMLElement
          ? tweetTextElement.innerText
          : "No content available";

      const authorElement = document.querySelector(
        "article a[role='link'] span"
      );
      const author =
        authorElement instanceof HTMLElement
          ? authorElement.innerText
          : "Unknown author";

      const timestampElement = document.querySelector("article time");
      const timestamp = timestampElement
        ? timestampElement.getAttribute("datetime") ?? "Unknown time"
        : "Unknown time";

      const imageElement = document.querySelector("article img[srcset]");
      const image =
        imageElement instanceof HTMLImageElement ? imageElement.src : null;

      return {
        title: tweetText.substring(0, 100),
        description: tweetText,
        author,
        timestamp,
        image,
      };
    });

    return metadata;
  } catch (error) {
    console.error("Error extracting tweet metadata:", error);
    return {
      title: "Untitled",
      description: "No content available.",
      author: "Unknown author",
      timestamp: "Unknown time",
      image: null,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
// AI-powered content analysis
const analyzeContent = async (text: string, sourceUrl: string) => {
  const prompt = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `
            Analyze this content and provide:
            1. Key topics (as tags)
            2. Brief summary
            3. Main concepts
            4. Related areas

            Content: ${text}
            Source: ${sourceUrl}
          `,
          },
        ],
      },
    ],
  };

  const result = await model.generateContent(prompt);
  return result.response.text();
};

// AI-powered relationship suggestions
const suggestRelationships = async (text: string, analysis: string) => {
  const prompt = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `
            Analyze this content and suggest:
            1. Related topics it should be connected to
            2. What learning path it might belong to
            3. Similar content clusters

            Content: ${text}
            Analysis: ${analysis}
          `,
          },
        ],
      },
    ],
  };

  const result = await model.generateContent(prompt);
  return result.response.text();
};

// Storing content in the database
const storeContent = async (data: {
  link: string;
  type: ContentType;
  title: string;
  extractedText: string;
  keywords: string[];
  metadata: object;
  userId: number;
  embeddings: { title: number[]; description: number[] };
}) => {
  return prisma.content.create({
    data: {
      link: data.link,
      type: data.type,
      title: data.title,
      extractedText: data.extractedText,
      keywords: data.keywords,
      metadata: data.metadata,
      user: {
        connect: { id: data.userId },
      },
    },
  });
};

enum ContentType {
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  ARTICLE = "ARTICLE",
  AUDIO = "AUDIO",
  TEXT = "TEXT",
  NOTE = "NOTE",
}

// Quick capture handler
type Metadata = {
  title: string;
  description: string;
  image?: string | null; // Allow null values
  author?: string;
  timestamp?: string;
};
type MetadataResponse = {
  success: boolean;
  message: string;
  data?: Metadata;
  error?: any;
};
// Import the embedding service
import { Pinecone } from "@pinecone-database/pinecone";
// Make sure this function exists

// Define the function to capture content
export const quickCapture = async (
  req: Request, // You may need to extend this if you're using AuthRequest
  res: Response
): Promise<any> => {
  try {
    const { selectedText, sourceUrl, imageUrl, options, type } = req.body;

    // Validate content type
    if (!Object.values(ContentType).includes(type)) {
      return res.status(400).json({
        message: "Invalid content type provided",
        success: false,
      });
    }

    let metadata: Metadata = {
      title: "",
      description: "",
      image: "",
      author: "",
      timestamp: "",
    };

    let analysis = "";

    // Handle content type logic (same as before)
    switch (type) {
      case "TEXT":
      case "ARTICLE":
        metadata = sourceUrl
          ? (await extractMetadata(sourceUrl)).data || metadata
          : metadata;
        break;
      case "IMAGE":
        if (!imageUrl) {
          return res
            .status(400)
            .json({ message: "Image URL required", success: false });
        }
        const imageAnalysis = await analyzeImage(imageUrl);
        metadata.title = imageAnalysis.title || "Captured Image";
        metadata.description =
          imageAnalysis.description || "No description available.";
        metadata.image = imageUrl;
        break;
    }
    const user = (req as AuthRequest).user; // Ensure user exists
    const userId = user.id;

    // Generate embeddings for title and description
    const titleEmbedding =
      metadata.title && metadata.title.trim()
        ? await generateEmbedding(metadata.title)
        : [];

    const descriptionEmbedding =
      metadata.description && metadata.description.trim()
        ? await generateEmbedding(metadata.description)
        : [];

    console.log("Title embedding size:", titleEmbedding.length);
    console.log("Description embedding size:", descriptionEmbedding.length);
    // Step 2: Call the storeInPinecone function
    if (titleEmbedding.length || descriptionEmbedding.length) {
      // Pass embeddings directly to storeInPinecone
      await storeInPinecone(
        metadata.title,
        metadata.description,
        type,
        userId,
        titleEmbedding,
        descriptionEmbedding
      );
    }

    // Save the content to your database (assuming a storeContent function exists)

    // Store the content in the database
    const content = await storeContent({
      link: sourceUrl || imageUrl, // Assuming you want to store the URL
      type,
      title: metadata.title,
      extractedText: selectedText || "", // Assuming selectedText exists
      keywords: options || [], // Assuming options are your keywords
      metadata, // This can be the metadata object we filled
      userId,
      embeddings: {
        title: titleEmbedding,
        description: descriptionEmbedding,
      },
    });

    // Return success response
    res.status(201).json({
      message: "Content captured successfully",
      data: { content },
      success: true,
    });
  } catch (error) {
    console.error("Error in quick capture:", error);
    res.status(500).json({
      message: "Error capturing content",
      success: false,
      error: (error as Error).message,
    });
  }
};

async function getPageContext(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    return JSON.stringify({
      title: $("title").text(),
      description: $('meta[name="description"]').attr("content") || "",
      keywords: $('meta[name="keywords"]').attr("content") || "",
    });
  } catch (error) {
    console.error("Error fetching page context:", error);
    return "";
  }
}
