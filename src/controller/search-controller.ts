import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PrismaClient } from "@prisma/client";
import { resizeEmbedding } from "../utils/generateEmbedding";

// Initialize clients
const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const embeddingModel = genAI.getGenerativeModel({
  model: "text-embedding-004",
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "your-api-key",
});
const index = pinecone.Index("search-index");

// Embedding generation utilities

const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    if (!text.trim()) {
      throw new Error("Empty text provided for embedding generation");
    }

    const result = await embeddingModel.embedContent(text);
    const embedding = result.embedding.values;

    if (!embedding || !embedding.length) {
      throw new Error("Invalid embedding generated");
    }

    console.log(`Original embedding dimension: ${embedding.length}`);

    const resized = resizeEmbedding(embedding, 1024);

    if (resized.length !== 1024) {
      throw new Error(
        `Resizing failed. Expected 1024 dimensions, got ${resized.length}`
      );
    }

    const magnitude = Math.sqrt(
      resized.reduce((sum, val) => sum + val * val, 0)
    );
    const normalized = resized.map((val) => val / magnitude);

    console.log(`Final embedding dimension: ${normalized.length}`);
    return normalized;
  } catch (error: any) {
    console.error("Error in generateEmbedding:", error);
    throw new Error(
      `Failed to generate 1024-dimensional embedding: ${error.message}`
    );
  }
};

// Search controller
export const searchContentController = async (
  userId: number,
  query: string
) => {
  try {
    // Step 1: Generate query embedding
    console.log("Generating embedding for query...");
    const queryEmbedding = await generateEmbedding(query);

    // Step 2: Search Pinecone for matches
    console.log("Searching Pinecone for content...");
    const pineconeResults = await index.query({
      vector: queryEmbedding,
      filter: { userId: userId },
      topK: 1,
      includeMetadata: true,
    });
    console.log("Pinecone search results:", pineconeResults);

    if (!pineconeResults.matches || pineconeResults.matches.length === 0) {
      console.log("No matching content found in Pinecone.");
      return { results: [], message: "No matching content found." };
    }

    // Step 3: Match metadata with the Content table
    const results = await Promise.all(
      pineconeResults.matches.map(async (match) => {
        const metadata = match.metadata || {};
        console.log("Processing metadata:", metadata);

        try {
          const content = await prisma.content.findFirst({
            where: {
              userId: userId,
              title: metadata.title as string,
              metadata: {
                path: ["description"],
                string_contains: metadata.description as string,
              },
            },
            select: {
              id: true,
              title: true,
              link: true,
              metadata: true,
              publishedAt: true,
            },
          });

          if (content) {
            // Parse the metadata JSON field safely
            const contentMetadata =
              typeof content.metadata === "object"
                ? (content.metadata as any)
                : {};

            return {
              id: content.id,
              title: content.title,
              description:
                contentMetadata.description ||
                metadata.description ||
                "No description available",
              image: contentMetadata.image || metadata.image || null,
              author: contentMetadata.author || metadata.author || "Unknown",
              timestamp: content.publishedAt?.toISOString() || null,
              link: content.link,
              score: match.score,
            };
          } else {
            // Fallback to using Pinecone metadata if no database match
            return {
              title: metadata.title || "Unknown Title",
              description: metadata.description || "No description available",
              image: metadata.image || null,
              author: metadata.author || "Unknown",
              timestamp: metadata.timestamp || null,
              link: metadata.link || "#",
              score: match.score,
            };
          }
        } catch (error) {
          console.error("Error querying Content table:", error);
          // Fallback to metadata from Pinecone in case of error
          return {
            title: metadata.title || "Error Processing Content",
            description:
              metadata.description || "Error retrieving content details",
            link: metadata.link || "#",
            score: match.score,
          };
        }
      })
    );

    // Filter out null results
    const filteredResults = results.filter(
      (result): result is NonNullable<typeof result> => result !== null
    );

    return {
      results: filteredResults,
      message:
        filteredResults.length > 0
          ? "Search completed successfully"
          : "No detailed content found.",
    };
  } catch (error: any) {
    console.error("Error in searchContentController:", error);
    return {
      results: [],
      message: `An error occurred while searching content: ${error.message}`,
      error: true,
    };
  }
};
export { generateEmbedding, resizeEmbedding };
