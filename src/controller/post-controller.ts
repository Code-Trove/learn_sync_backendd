import { Request } from "express";
import OAuth from "oauth-1.0a";
import crypto from "crypto";
import { Request as ExpressRequest, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
type AuthenticatedUser = {
  id: number;
  email?: string | null;
  name: string;
  username?: string | null;
  twitterId?: string | null;
  twitterToken?: string | null;
  twitterSecret?: string | null;
  linkedinId?: string | null;
  linkedinToken?: string | null;
};

export const craftPosts = async (
  req: Request,
  res: Response
): Promise<void> => {
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
};

export const craftThougts = async (req: Request, res: Response) => {
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
};

const oauth = new OAuth({
  consumer: {
    key: process.env.TWITTER_CONSUMER_KEY!, // Your API Key
    secret: process.env.TWITTER_CONSUMER_SECRET!, // Your API Secret
  },
  signature_method: "HMAC-SHA1",
  hash_function(base_string, key) {
    return crypto.createHmac("sha1", key).update(base_string).digest("base64");
  },
});

export const postToTwitter = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const user = req.user as AuthenticatedUser;
    const { content } = req.body;
    console.log("User:", user);

    if (!user || !user.twitterToken || !user.twitterSecret) {
      return res.status(400).json({
        success: false,
        error: "Twitter not connected or missing credentials.",
      });
    }
    // Add this before making the request
    console.log("OAuth Config:", {
      consumerKey: process.env.TWITTER_CONSUMER_KEY!,
      hasConsumerSecret: process.env.TWITTER_CONSUMER_SECRET!
        ? "**present**"
        : "**missing**",
      tokenKey: user.twitterToken,
      hasTokenSecret: !!user.twitterSecret,
    });

    const request_data = {
      url: "https://api.twitter.com/2/tweets",
      method: "POST",
    };

    // Generate OAuth headers
    const token = {
      key: user.twitterToken, // OAuth Token
      secret: user.twitterSecret, // OAuth Token Secret
    };
    console.log("Token:", token);

    const authHeader = oauth.toHeader(oauth.authorize(request_data, token));
    console.log("Auth Header:", authHeader);

    const response = await fetch(request_data.url, {
      method: request_data.method,
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: content }),
    });

    const responseData = await response.json();
    console.log("Response:", responseData);

    if (!response.ok) {
      console.error("Twitter API Error:", responseData);
      return res.status(response.status).json({
        success: false,
        error: responseData.detail || "Failed to post tweet.",
      });
    }

    res.json({
      success: true,
      message: "Tweet posted successfully!",
      data: responseData,
    });
  } catch (error) {
    console.error("Error posting tweet:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

export const scheduledTweets = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const user = req.user as AuthenticatedUser;
    const { content, scheduledTime } = req.body;

    if (!user || !user.twitterToken || !user.twitterSecret) {
      return res.status(400).json({
        success: false,
        error: "Twitter not connected or missing credentials.",
      });
    }

    // Insert the scheduled tweet into the database
    const scheduledTweet = await prisma.scheduledTweet.create({
      data: {
        user_id: user.id, // Use the authenticated user's ID
        content: content,
        twitter_token: user.twitterToken,
        twitter_secret: user.twitterSecret,
        scheduled_time: new Date(scheduledTime),
        status: "PENDING",
      },
    });

    res.status(201).json({
      success: true,
      message: "Tweet scheduled successfully!",
      data: scheduledTweet,
    });
  } catch (error) {
    console.error("Error scheduling tweet:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};
