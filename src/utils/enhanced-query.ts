import fetch from "node-fetch";

export const enhanceQueryWithGemini = async (
  query: string
): Promise<string> => {
  try {
    // Create the request body for the Gemini API
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `
              User's Query: "${query}"
              
              Task: Enhance this query to make it more specific, contextual, and suitable for retrieving the most accurate and high-quality search results. Use synonyms, rephrase for clarity, and add any missing context based on common user intent.
            `,
            },
          ],
        },
      ],
    };

    // Call the Gemini API
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

    console.log("Gemini API response status:", response.status);

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    // Parse the response from Gemini API
    const data = await response.json();
    console.log(
      "Full response from Gemini API:",
      JSON.stringify(data, null, 2)
    );
    console.log("Enhanced query:", data.candidates[0].content?.parts[0]?.text);
    // Extract the enhanced query from the response
    const enhancedQuery = data.candidates[0].content?.parts[0]?.text || query; // Fallback to the original query if enhancement fails

    return enhancedQuery;
  } catch (error) {
    console.error("Error enhancing query with Gemini:", error);
    return query; // Return the original query in case of an error
  }
};
