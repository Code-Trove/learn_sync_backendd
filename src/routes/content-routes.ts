import express from "express";
import passport from "passport";
import {
  addContent,
  getAllContent,
  shareWithUser,
  makeContentPublic,
  makeContentPrivate,
  accessSharedContent,
  searchContent,
  schedulePost,
  postScheduledContent,
  saveAndScheduleCraftedPost,
  postScheduledCraftedPost,
} from "../controller/content-controller";
import { authenticate } from "../middleware/authenticate";
import { PrismaClient } from "@prisma/client";
import { OpenAI } from "openai";
import { Request, Response } from "express";

const router = express.Router();
const prisma = new PrismaClient();

router.post("/content/addContent", authenticate, addContent);
router.get("/get-content", getAllContent);
router.post("/share/user", shareWithUser); // Share with specific user
router.post("/share/public", makeContentPublic); // Make content public
router.post("/share/private", makeContentPrivate); // Make content private again
router.get("/shared/:hash", accessSharedContent);
router.get("/search", searchContent);

// New routes for scheduling and posting content
router.post("/content/schedule", schedulePost);
router.post("/content/postScheduled", postScheduledContent);

// New route for saving and scheduling crafted posts
router.post("/content/saveAndScheduleCraftedPost", saveAndScheduleCraftedPost);
router.post("/content/postScheduledCraftedPost", postScheduledCraftedPost);

router.get("/captures/recent", getAllContent);

// Add this function to create a test user if it doesn't exist
async function getOrCreateTestUser() {
  let testUser = await prisma.user.findFirst({
    where: { email: "test@example.com" },
  });

  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        email: "test@example.com",
        name: "Test User",
        password: "test123", // In production, this should be hashed
      },
    });
  }

  return testUser;
}

// Update the captures/recent POST route

// Update the explore endpoint
router.post("/content/explore", async (req, res) => {
  try {
    const { content } = req.body;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Changed from gpt-4 for faster response
      messages: [
        {
          role: "system",
          content:
            "You are an expert at analyzing content. Provide a concise summary and 3 key insights.",
        },
        {
          role: "user",
          content: `Analyze this content and provide:
          1. A brief summary (2-3 sentences)
          2. 3 key insights
          3. Suggested tags
          
          Content: ${content}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const analysis = response.choices[0].message.content;

    res.status(200).json({
      success: true,
      summary: analysis,
      insights: [], // You can parse the response to separate insights if needed
    });
  } catch (error) {
    console.error("Error exploring content:", error);
    res.status(500).json({
      success: false,
      error: "Failed to explore content",
    });
  }
});

router.post(
  "/content/chat",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { content, question, pageContext, sourceUrl } = req.body;
      // console.log("Received content:", content);
      console.log("Received question:", question);
      // console.log("Received page context:", pageContext);
      // console.log("Received source URL:", sourceUrl);

      if (!content || !question || !pageContext || !sourceUrl) {
        res.status(400).json({
          success: false,
          error:
            "Content, question, page context, and source URL must be provided",
        });
        return;
      }

      // List of common greetings for detection
      const isGreeting =
        /\b(hi+|hello+|hey+|greet+|yo+|hlw+|hii+|hola+|sup)\b/i.test(question);

      // Handle initial greeting response
      if (isGreeting) {
        res.status(200).json({
          success: true,
          response:
            "Hello! 😊 Do you have a specific question, or would you like me to explain the content in detail? Let me know how I can assist you better!",
        });
        return;
      }

      const affirmativeResponses = [
        "yes",
        "sure",
        "go ahead",
        "explain",
        "okay",
      ];
      if (affirmativeResponses.includes(question.toLowerCase())) {
        res.status(200).json({
          success: true,
          response: `
          Certainly! Here's a detailed explanation based on the provided content:
          "${content}"
          
          I'll break it down with real-world examples, practical applications, and analogies to ensure clarity. If you have further questions, feel free to ask! 😊
        `,
        });
        return;
      }

      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: `
                Full Page Context: "${pageContext}"
                Source URL: "${sourceUrl}"
                
                Content for analysis: "${content}"
                
                User's Question: "${question}"
                
                Answer the user's question directly with a detailed explanation. If the question is unclear, politely ask for clarification. If the question is related to the content, explain thoroughly using real-world analogies, practical examples, and references for clarity.
                
                After answering, ask the user:
                "Would you like to move to the next topic or deep dive into this topic?"
              `,
              },
            ],
          },
        ],
      };

      // Make the POST request to the Gemini API
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
      console.log("Gemini API response status:", response);

      const data = await response.json();
      console.log(
        "Full response from Gemini API:",
        JSON.stringify(data, null, 2)
      );

      if (data.candidates && data.candidates.length > 0) {
        const candidateContent =
          data.candidates[0].content?.parts[0]?.text ||
          "No valid content found.";
        res.status(200).json({
          success: true,
          response: candidateContent,
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Gemini API returned no valid candidates",
        });
      }
    } catch (error) {
      console.error("Chat processing failed:", error);
      res.status(500).json({
        success: false,
        error: "Failed to process chat, please try again later.",
      });
    }
  }
);

router.post(
  "/content/summary",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { content, discussion } = req.body;

      const summaryPrompt = {
        contents: [
          {
            parts: [
              {
                text: `Summarize this content and discussion into a clear, engaging format.
                  Content: ${content}
                  Discussion: ${JSON.stringify(discussion)}
                  
                  Requirements:
                  - Create a concise summary
                  - Focus on key points
                  - Use professional tone
                  - Avoid mentioning user interactions or discussions
                  - Avoid technical jargon
                  - Make it readable and shareable
                  - Focus only on relevant information from the content
                  
                  Format the response as plain text without any special formatting.`,
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
          body: JSON.stringify(summaryPrompt),
        }
      );

      const data = await response.json();

      // Extract clean text from Gemini response
      const summaryText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      if (!summaryText) {
        throw new Error("Failed to generate summary");
      }

      res.status(200).json({
        success: true,
        summary: summaryText,
      });
    } catch (error) {
      console.error("Summary generation failed:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to generate summary",
      });
    }
  }
);

router.post(
  "/content/craft-posts",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { summary } = req.body;

      const twitterPrompt = {
        contents: [
          {
            parts: [
              {
                text: `Create a concise Twitter post based on this summary about JavaScript:
                "${summary}"
                
                Requirements:
                - Keep under 280 characters
                - Focus on the educational aspect
                - Include 2-3 relevant hashtags
                - Maintain professional tone
                - Avoid excessive emojis`,
              },
            ],
          },
        ],
      };

      const linkedinPrompt = {
        contents: [
          {
            parts: [
              {
                text: `Create a professional LinkedIn post based on this JavaScript content:
                "${summary}"

                Post Structure:
                1. Start with a brief, engaging title
                2. Explain the topic's importance
                3. Share key insights from the summary
                4. Add value by providing additional context
                5. End with an engaging question
                6. Include 3-4 relevant hashtags

                Keep the tone professional and educational.`,
              },
            ],
          },
        ],
      };

      const [twitterResponse, linkedinResponse] = await Promise.all([
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(twitterPrompt),
          }
        ),
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(linkedinPrompt),
          }
        ),
      ]);

      const [twitterData, linkedinData] = await Promise.all([
        twitterResponse.json(),
        linkedinResponse.json(),
      ]);

      const twitter =
        twitterData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      const linkedin =
        linkedinData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      // Clean and format responses
      const cleanTwitter = twitter.replace(/\n+/g, " ").substring(0, 280);

      const cleanLinkedin = linkedin.replace(/\n\n+/g, "\n\n").trim();

      res.status(200).json({
        success: true,
        twitter: cleanTwitter,
        linkedin: cleanLinkedin,
        facebook: cleanLinkedin,
        instagram: cleanTwitter,
      });
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to generate social media posts",
      });
    }
  }
);
router.post(
  "/content/craft-thought",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { thought } = req.body;

      const twitterPrompt = {
        contents: [
          {
            parts: [
              {
                text: `Transform this thought into an engaging Twitter post:
            "${thought}"
            
            Requirements:
            - Keep under 280 characters
            - Make it conversational and authentic
            - Add 2-3 relevant hashtags
            - Include appropriate emojis
            - Maintain personal voice`,
              },
            ],
          },
        ],
      };

      const linkedinPrompt = {
        contents: [
          {
            parts: [
              {
                text: `Transform this thought into a professional LinkedIn post:
            "${thought}"

            Requirements:
            1. Start with a personal reflection
            2. Share the main insight
            3. Connect it to professional growth
            4. Add a call to action or question
            5. Include 2-3 relevant hashtags

            Keep it authentic and professional.`,
              },
            ],
          },
        ],
      };

      const [twitterResponse, linkedinResponse] = await Promise.all([
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(twitterPrompt),
          }
        ),
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(linkedinPrompt),
          }
        ),
      ]);

      const [twitterData, linkedinData] = await Promise.all([
        twitterResponse.json(),
        linkedinResponse.json(),
      ]);

      const twitter =
        twitterData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      const linkedin =
        linkedinData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      // Clean and format responses
      const cleanTwitter = twitter.replace(/\n+/g, " ").substring(0, 280);
      const cleanLinkedin = linkedin.replace(/\n\n+/g, "\n\n").trim();

      res.status(200).json({
        success: true,
        twitter: cleanTwitter,
        linkedin: cleanLinkedin,
        facebook: cleanLinkedin, // Using LinkedIn format for Facebook
        instagram: cleanTwitter, // Using Twitter format for Instagram
      });
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to craft social media thoughts",
      });
    }
  }
);

// Local authentication routes

export default router;
