// Define the individual context metadata item type
type ContextMetadataItem = {
  title: string;
  description: string;
  image: string | null;
  author: string;
  timestamp: string | null;
  link: string;
  score: number;
};

// Then define the array type
type ContextMetadata = ContextMetadataItem[];

export const generateResponseFromMetadata = async (
  metadata: ContextMetadataItem, // Now using the properly defined type
  isNewTopic: boolean
): Promise<string> => {
  try {
    const content = `
      Title: "${metadata.title}"
      Description: "${metadata.description}"
      Image: "${metadata.image || "No image available"}"
      Author: "${metadata.author}"
      Timestamp: "${metadata.timestamp || "Unknown time"}"
      Link: "${metadata.link}"
    `;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `Metadata: ${content}
          
          Task: ${
            isNewTopic
              ? "Introduce this topic and ask if the user wants more details"
              : "Provide deeper insights and suggest next exploration steps"
          }
          
          Always end with a relevant follow-up question.`,
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
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();
    return (
      data.candidates[0].content?.parts[0]?.text.trim() ||
      "Would you like me to elaborate further on this topic?"
    );
  } catch (error) {
    console.error("Error generating metadata response:", error);
    return "I have more information about this if you're interested.";
  }
};
