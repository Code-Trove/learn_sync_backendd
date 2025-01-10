import express, { RequestHandler } from "express";
import { OpenAI } from "openai";
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Share content to social media
const shareHandler: RequestHandler = async (req, res) => {
  try {
    const { contentId, platforms, customText } = req.body;

    // Validate request
    if (!contentId || !platforms || platforms.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
      return;
    }

    // Get the content
    const content = await prisma.content.findUnique({
      where: { id: contentId }
    });

    if (!content) {
      res.status(404).json({
        success: false,
        error: 'Content not found'
      });
      return;
    }

    // For now, just simulate sharing
    const shares = platforms.map((platform: string) => ({
      platform,
      status: 'shared',
      url: content.link,
      text: customText || content.extractedText
    }));

    // Save share history
    await prisma.share.create({
      data: {
        contentId: content.id,
        platforms: platforms,
        customText: customText,
        userId: content.userId
      }
    });

    res.status(200).json({
      success: true,
      data: shares
    });
  } catch (error) {
    console.error('Share failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to share content'
    });
  }
};

// Craft social media post
const craftPostHandler: RequestHandler = async (req, res): Promise<void> => {
  try {
    const { content, platform = 'twitter', style = 'professional' } = req.body;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a social media expert. Craft a ${style} post for ${platform}.`
        },
        {
          role: "user",
          content: `Create a ${platform} post about this content: ${content}`
        }
      ],
      temperature: 0.7,
      max_tokens: 280
    });

    res.status(200).json({
      success: true,
      post: response.choices[0].message.content
    });
    return;

  } catch (error) {
    console.error('Error crafting post:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to craft post'
    });
    return;
  }
};

router.post("/share", shareHandler);
router.post("/craft-post", craftPostHandler);

export default router; 