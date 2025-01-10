import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import OpenAI from 'openai';
import { craftPlatformPost, Platform } from '../utils/post-crafter';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface SocialPostRequest {
  contentId?: number;
  thought?: string;
  style?: 'professional' | 'casual' | 'technical' | 'minimal' | 'thread';
  platforms: Platform[];
  customization?: {
    tone?: string;
    length?: 'short' | 'medium' | 'long';
    includeHashtags?: boolean;
    includeEmojis?: boolean;
  };
}

interface ContentWithContexts {
  id: number;
  extractedText: string | null;
  keywords: string[];
  metadata: any;
  contexts: {
    id: number;
    userThought: string | null;
    contentId: number;
    createdAt: Date;
    updatedAt: Date;
    sourceUrl: string | null;
    selectedText: string | null;
    pageContext: string | null;
    captureTime: Date;
  }[];
}

export const generateSocialPosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { contentId, thought, style = 'professional', platforms, customization } = req.body as SocialPostRequest;

    let content: ContentWithContexts | null = null;
    if (contentId) {
      content = await prisma.content.findUnique({
        where: { id: contentId },
        include: {
          contexts: true
        }
      });
    }

    // Generate enhanced content
    const enhancedContent = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You're a social media expert who crafts engaging, platform-optimized content."
        },
        {
          role: "user",
          content: `
            Content: ${content?.extractedText || thought}
            Context: ${content?.contexts.map(c => c.userThought).join('\n')}
            Style: ${style}
            Customization: ${JSON.stringify(customization)}

            Create engaging social media content that:
            1. Captures the key insights
            2. Is optimized for each platform
            3. Follows the requested style and customization
          `
        }
      ]
    });

    // Generate platform-specific posts
    const posts = await Promise.all(
      platforms.map(platform => 
        craftPlatformPost(
          {
            summary: enhancedContent.choices[0].message.content || '',
            keyPoints: content?.keywords || [],
            learnings: thought || ''
          },
          platform,
          style
        )
      )
    );

    // Save generated posts if there's a content ID
    if (contentId) {
      await prisma.content.update({
        where: { id: contentId },
        data: {
          metadata: {
            ...content?.metadata,
            socialPosts: Object.fromEntries(
              platforms.map((platform, index) => [platform, posts[index]])
            )
          }
        }
      });
    }

    res.status(200).json({
      message: "Social posts generated successfully",
      data: {
        posts: Object.fromEntries(
          platforms.map((platform, index) => [platform, posts[index]])
        )
      },
      success: true
    });

  } catch (error) {
    console.error("Error generating social posts:", error);
    res.status(500).json({
      message: "Error generating social posts",
      success: false,
      error: (error as Error).message
    });
  }
};

export const previewPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const { platform, post } = req.body;

    // Generate a preview image using OpenAI's DALL-E
    const preview = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Create a social media preview image for a ${platform} post about: ${post.substring(0, 100)}...`,
      n: 1,
      size: "1024x1024",
    });

    res.status(200).json({
      message: "Preview generated successfully",
      data: {
        previewUrl: preview.data[0].url,
        post
      },
      success: true
    });

  } catch (error) {
    console.error("Error generating preview:", error);
    res.status(500).json({
      message: "Error generating preview",
      success: false,
      error: (error as Error).message
    });
  }
}; 