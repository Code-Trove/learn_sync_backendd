import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // Use Gemini to create embeddings
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text }] }],
    });

    // Convert response to vector format
    const embedding = result.response
      .text()
      .split(",")
      .map((num) => parseFloat(num.trim()));

    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
};

export const generateContentEmbedding = async (content: {
  title: string;
  extractedText: string;
  keywords: string[];
}): Promise<number[]> => {
  const combinedText = `${content.title} ${
    content.extractedText
  } ${content.keywords.join(" ")}`;
  return generateEmbedding(combinedText);
};
