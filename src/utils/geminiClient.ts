import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Gemini client
export const initGeminiClient = (): GoogleGenerativeAI => {
  const apiKey = process.env.GEMINI_API_KEY; // API key from environment variables
  if (!apiKey) {
    throw new Error("Gemini API key is not set in environment variables.");
  }

  return new GoogleGenerativeAI(apiKey);
};
