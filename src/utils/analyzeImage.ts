import { initGeminiClient } from "./geminiClient";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || "default_api_key"
);
const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });

type Metadata = {
  title: string;
  description: string;
  image?: string | null;
};

// Analyze the image and generate metadata
export const analyzeImage = async (imageUrl: string): Promise<Metadata> => {
  try {
    console.log("Analyzing image:", imageUrl);
    const client = initGeminiClient();
    console.log("Gemini client initialized.");

    // Fetch the image from the URL
    const imageResponse = await fetch(imageUrl);
    console.log("Image response:", imageResponse);

    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image. Status: ${imageResponse.status}`);
    }

    // Convert the image to a base64 string
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    // Initialize the Gemini model
    const geminiModel = client.getGenerativeModel({
      model: "models/gemini-1.5-pro",
    });
    console.log("Gemini model initialized.");

    // Use the Gemini model to generate analysis text
    const prompt =
      "Describe this image in detail while remaining concise. Include objects, actions, people, and the setting. Make the description between 50-100 words and suitable for querying.";
    const result = await geminiModel.generateContent([
      { inlineData: { data: base64Image, mimeType: "image/jpeg" } },
      prompt,
    ]);
    console.log("Gemini model result:", result);

    const responseText = result.response.text();
    console.log("Gemini response text:", responseText);

    if (!responseText || typeof responseText !== "string") {
      throw new Error("Invalid response from Gemini API.");
    }

    // Use the AI model to generate precise metadata
    const metadataPrompt = `
      Based on the following image description, generate metadata:
      Description: "${responseText}"
      - Title: Summarize the image in one concise sentence (10-15 words).
      - Description: Write a highly detailed description of the image in 50-100 words, making it suitable for search queries and specific use cases.
    `;
    const metadataResult = await model.generateContent([metadataPrompt]);
    const metadataResponseText = metadataResult.response.text();
    console.log("Generated metadata text:", metadataResponseText);

    // Extract the **Title:** and **Description:** markers from the response
    const titleMatch = metadataResponseText.match(/(?:Title:\s*)([^\n]+)/i);
    const descriptionMatch = metadataResponseText.match(
      /(?:Description:\s*)([\s\S]+)/i
    );

    const title = titleMatch ? titleMatch[1].trim() : "Untitled";
    const description = descriptionMatch
      ? descriptionMatch[1].trim()
      : "No description available.";

    // Ensure the description is between 50-100 words
    const wordCount = description.split(/\s+/).length;
    if (wordCount < 50 || wordCount > 100) {
      throw new Error(
        `Generated description is ${wordCount} words. Expected between 50-100 words.`
      );
    }

    // Construct and return the metadata
    const metadata: Metadata = {
      title,
      description,
      image: imageUrl, // Include the image URL in metadata
    };

    console.log("Generated Metadata:", metadata);
    return metadata;
  } catch (error) {
    console.error("Error analyzing image:", error);
    throw new Error("Failed to analyze image and generate metadata.");
  }
};
