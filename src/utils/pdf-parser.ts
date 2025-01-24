import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || "default_api_key"
);
const fileManager = new GoogleAIFileManager(
  process.env.GEMINI_API_KEY || "default_api_key"
);

// File manager instance
const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });

type Metadata = {
  title: string;
  description: string;
  image?: string | null;
};

export async function processLargePdfFromUrl(
  pdfUrl: string
): Promise<Metadata> {
  try {
    console.log("Processing large PDF from URL:", pdfUrl);

    // Fetch and prepare the PDF file
    const pdfBuffer = await fetch(pdfUrl).then((response) =>
      response.arrayBuffer()
    );
    const tempFilePath = "./tempPdf.pdf";
    require("fs").writeFileSync(tempFilePath, Buffer.from(pdfBuffer), "binary");

    // Upload the PDF file
    const uploadResult = await fileManager.uploadFile(tempFilePath, {
      mimeType: "application/pdf",
      displayName: "Large PDF Document",
    });
    require("fs").unlinkSync(tempFilePath);

    // Generate metadata prompt
    const prompt = `
      Extract the metadata for the provided PDF document:
      - Title: Provide a concise single-sentence title summarizing the document's purpose or content.
      - Description: Provide a detailed description (up to 100 words) summarizing the key points, context, and highlights of the document. 
      Please ensure that the title is distinct and concise, separate from the description, which provides clear and relevant information without repeating the title.
    `;

    const result = await model.generateContent([
      {
        fileData: {
          fileUri: uploadResult.file.uri,
          mimeType: uploadResult.file.mimeType,
        },
      },
      prompt,
    ]);

    // Extract the response text
    const responseText = result.response.text();

    // Look for the **Title:** and **Description:** markers in the response
    const titleMatch = responseText.match(/(?:\*\*Title:\*\*\s*)([^\n]+)/);
    const descriptionMatch = responseText.match(
      /(?:\*\*Description:\*\*\s*)([\s\S]+)/
    );

    let title = titleMatch ? titleMatch[1].trim() : "Untitled";
    let description = descriptionMatch
      ? descriptionMatch[1].trim()
      : "No description available.";

    // Construct metadata
    const metadata: Metadata = {
      title,
      description,
      image: null, // No image extraction for now
    };

    console.log("Generated Metadata:", metadata);
    return metadata;
  } catch (error) {
    console.error("Error processing PDF:", error);
    throw new Error("Failed to process PDF metadata.");
  }
}
