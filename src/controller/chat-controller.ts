import { searchContentController } from "./search-controller";
import { enhanceQueryWithGemini } from "../utils/enhanced-query";
import { generateResponseFromMetadata } from "../utils/metadataResponse";
import { Request, Response } from "express";
import { User } from "@prisma/client";

type ContextMetadataItem = {
  title: string;
  description: string;
  image: string | null;
  author: string;
  timestamp: string | null;
  link: string;
  score: number;
  lastQuestion?: string;
};

type ContextMetadata = ContextMetadataItem[];

type UserContext = {
  source: "database" | "general";
  metadata: ContextMetadata;
  timestamp: string;
};

interface ChatRequest {
  query: string;
  conversationId?: string | null;
  resetConversation?: boolean;
}

const userContextMap = new Map<string, UserContext & { searchHit: boolean }>();

export const chatWithUserController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { query, conversationId, resetConversation } =
      req.body as ChatRequest;
    console.log("Request user:", resetConversation);
    console.log("Request body:", req.body);
    const user = req.user as User;
    const userId = user.id;

    if (!userId || !query) {
      return res.status(400).json({ error: "User ID and query are required." });
    }

    // Handle conversation reset
    const contextKey = resetConversation
      ? userId.toString()
      : conversationId || userId.toString();

    let userContext = userContextMap.get(contextKey);

    if (resetConversation || !userContext) {
      userContext = {
        source: "general",
        metadata: [],
        timestamp: new Date().toISOString(),
        searchHit: false, // New flag to track if a valid response was sent
      };
    }

    // Skip search controller if a valid response was sent previously
    if (userContext.searchHit) {
      console.log(
        "Search controller skipped as valid response was already sent in this conversation."
      );

      const fallbackResponse = await generateGeneralResponse(
        query,
        userContext.metadata
      );

      return res.status(200).json({
        response: fallbackResponse,
        link: null,
        conversationId: contextKey,
      });
    }

    // Enhanced query handling with context
    const enhancedQuery = await enhanceQueryWithGemini(
      userContext.metadata.length > 0
        ? `Context: ${JSON.stringify(userContext.metadata)}\nQuery: ${query}`
        : query
    );

    // Search with context-aware threshold
    const searchResults = await searchContentController(userId, enhancedQuery);

    if (searchResults.error) {
      return res.status(500).json({
        message: searchResults.message || "Error fetching search results.",
      });
    }

    const relevantResults = searchResults.results.filter(
      (result): result is typeof result & { score: number } =>
        result.score !== undefined && result.score >= 0.5 // Updated score threshold
    );

    let response: string;
    let newContextItem: ContextMetadataItem | null = null;

    if (relevantResults.length > 0) {
      const result = relevantResults[0];
      newContextItem = {
        title: String(result.title || "Unknown Title"),
        description: String(result.description || "No description available"),
        image: result.image ? String(result.image) : null,
        author: String(result.author || "Unknown"),
        timestamp: result.timestamp ? String(result.timestamp) : null,
        link: String(result.link || "#"),
        score: result.score ?? 0,
        lastQuestion: "Would you like more details about this?",
      };

      response = await generateResponseFromMetadata(newContextItem, true);
      userContext.metadata.push(newContextItem);

      // Mark that a valid response was sent
      userContext.searchHit = true;
    } else {
      response = await generateGeneralResponse(query, userContext.metadata);
    }

    // Update context storage
    userContextMap.set(contextKey, {
      ...userContext,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({
      response,
      link: newContextItem?.link || null,
      conversationId: contextKey,
    });
  } catch (error) {
    console.error("Error in chatWithUserController:", error);
    return res.status(500).json({
      message: "An unexpected error occurred while processing your request.",
    });
  }
};

// Keep generateFollowUpResponse and generateGeneralResponse functions same as before
// Modified response generator
export const generateGeneralResponse = async (
  query: string,
  context?: ContextMetadata
): Promise<string> => {
  try {
    // Create context-aware prompt
    const contextPrompt = context?.length
      ? `Relevant Context: ${JSON.stringify(context.slice(-2))}\n`
      : "";

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `${contextPrompt}User Query: "${query}"
              
              Task: Provide a comprehensive answer that:
              1. Acknowledges any relevant context (if provided)
              2. Gives a direct answer to the query
              3. Explains 3-5 key points
              4. Provides real-world examples
              5. Suggests next steps or related topics
              
              Formatting Rules:
              - Use markdown for readability
              - Keep paragraphs under 3 sentences
              - End with a natural follow-up question
              - Maintain conversational flow
              
              If context exists but isn't relevant:
              "While we have information about [context topic], here's what I know about [current query]..."`,
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
    const generatedText = data.candidates[0].content?.parts[0]?.text.trim();

    // Fallback response if no text generated
    return (
      generatedText ||
      `I'm still learning about ${
        query.split(" ")[0]
      }. Could you rephrase or provide more context?`
    );
  } catch (error) {
    console.error("Error generating general response:", error);
    return "I'm having trouble accessing that information right now. Please try again later.";
  }
};
