import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const embeddingModel = genAI.getGenerativeModel({
  model: "text-embedding-004",
});

/**
 * Generates embeddings for a given text input.
 * @param text - The text for which embeddings need to be generated.
 * @returns Array of embedding values (number[]).
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values; // Return the embedding values as an array
  } catch (error: any) {
    console.error("Error generating embedding:", error.message);
    throw new Error("Failed to generate embedding");
  }
};

/**
 * Stores content in Pinecone index after generating embeddings.
 * @param title - Title for the content.
 * @param description - Description for the content.
 * @param type - Content type (TEXT, IMAGE, etc.).
 */
export const storeInPinecone = async (
  title: string,
  description: string,
  type: string,
  userId: number,
  titleEmbedding: number[], // Accept pre-generated title embedding
  descriptionEmbedding: number[] // Accept pre-generated description embedding
) => {
  try {
    // Resize embeddings if necessary
    const resizedTitleEmbedding = resizeEmbedding(titleEmbedding, 1024);
    const resizedDescriptionEmbedding = resizeEmbedding(
      descriptionEmbedding,
      1024
    );

    // Initialize Pinecone client
    const client = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || "your-api-key",
    });
    const index = client.Index("search-index"); // Use the correct index name

    // Prepare data to upsert
    const upsertData: any[] = [
      {
        id: `title-${Date.now()}`,
        values: resizedTitleEmbedding,
        metadata: {
          type,
          title,
          userId,
          description, // Explicitly set description to undefined
        },
      },
    ];

    // Upsert to Pinecone index
    await index.upsert(upsertData);

    console.log("Content stored in Pinecone successfully");
  } catch (error: any) {
    console.error("Error storing content in Pinecone:", error.message);
  }
};

export const resizeEmbedding = (embedding: number[], targetSize: number) => {
  if (embedding.length === targetSize) return embedding;
  if (embedding.length > targetSize) return embedding.slice(0, targetSize);
  return [...embedding, ...Array(targetSize - embedding.length).fill(0)]; // Zero padding if it's smaller than the target size
};

// Resize the embeddings to 1024 dimensions
