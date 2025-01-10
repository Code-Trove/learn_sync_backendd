import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import OpenAI from 'openai';
import cheerio from 'cheerio';
import { craftPlatformPost, Platform } from '../utils/post-crafter';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface QuickCaptureOptions {
  instantSave: boolean;
  autoTagging: boolean;
  contextPreservation: boolean;
  sharingOptions: boolean;
}

interface AuthRequest extends Request {
  user: {
    id: number;
    // other user properties...
  };
}

export const captureContext = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sourceUrl, selectedText, pageContext, userThought, contentId } = req.body;

    const enhancedContext = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You're an expert at understanding context and enhancing learning materials."
        },
        {
          role: "user",
          content: `
            URL: ${sourceUrl}
            Selected Text: ${selectedText}
            Page Context: ${pageContext}
            User's Thought: ${userThought}

            Please analyze this context and provide:
            1. Key concepts mentioned
            2. Related topics
            3. Potential learning paths
          `
        }
      ]
    });

    const context = await prisma.contentContext.create({
      data: {
        sourceUrl,
        selectedText,
        pageContext,
        userThought,
        content: {
          connect: { id: contentId }
        }
      }
    });

    res.status(201).json({
      message: "Context captured successfully",
      data: {
        context,
        enhancement: enhancedContext.choices[0].message.content
      },
      success: true
    });

  } catch (error) {
    console.error("Error capturing context:", error);
    res.status(500).json({
      message: "Error capturing context",
      success: false,
      error: (error as Error).message
    });
  }
};

export const getContextsForContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { contentId } = req.params;

    const contexts = await prisma.contentContext.findMany({
      where: {
        contentId: Number(contentId)
      },
      orderBy: {
        captureTime: 'desc'
      }
    });

    res.status(200).json({
      message: "Contexts retrieved successfully",
      data: contexts,
      success: true
    });

  } catch (error) {
    console.error("Error retrieving contexts:", error);
    res.status(500).json({
      message: "Error retrieving contexts",
      success: false,
      error: (error as Error).message
    });
  }
};

export const quickCapture = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { selectedText, sourceUrl, options } = req.body;

    // Auto-generate tags and metadata using AI
    const enhancedContent = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You're an expert at analyzing content and extracting key information."
        },
        {
          role: "user",
          content: `
            Analyze this content and provide:
            1. Key topics (as tags)
            2. Brief summary
            3. Main concepts
            4. Related areas

            Content: ${selectedText}
            Source: ${sourceUrl}
          `
        }
      ]
    });

    const analysis = enhancedContent.choices[0].message.content || '';
    
    // Create content with auto-generated metadata
    const content = await prisma.content.create({
      data: {
        link: sourceUrl,
        type: 'TEXT',
        title: sourceUrl.split('/').pop() || 'Quick Capture',
        extractedText: selectedText,
        keywords: analysis.split('\n')
          .filter(line => line.startsWith('- '))
          .map(tag => tag.replace('- ', '')),
        metadata: {
          quickCapture: true,
          analysis,
          captureDate: new Date().toISOString()
        },
        user: {
          connect: { id: req.user.id } // Assuming you have user auth middleware
        }
      }
    });

    // If context preservation is enabled
    if (options.contextPreservation) {
      await prisma.contentContext.create({
        data: {
          sourceUrl,
          selectedText,
          pageContext: await getPageContext(sourceUrl),
          content: {
            connect: { id: content.id }
          }
        }
      });
    }

    // If sharing options are enabled, generate social posts
    let socialPosts;
    if (options.sharingOptions) {
      socialPosts = await generateQuickSharePosts(selectedText, analysis);
    }

    // Add relationship suggestions
    const relationshipSuggestions = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You're an expert at identifying content relationships and learning paths."
        },
        {
          role: "user",
          content: `
            Analyze this content and suggest:
            1. Related topics it should be connected to
            2. What learning path it might belong to
            3. Similar content clusters

            Content: ${selectedText}
            Analysis: ${analysis}
          `
        }
      ]
    });

    res.status(201).json({
      message: "Content captured successfully",
      data: {
        content,
        socialPosts,
        analysis,
        relationshipSuggestions: relationshipSuggestions.choices[0].message.content
      },
      success: true
    });

  } catch (error) {
    console.error("Error in quick capture:", error);
    res.status(500).json({
      message: "Error capturing content",
      success: false,
      error: (error as Error).message
    });
  }
};

async function getPageContext(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    return JSON.stringify({
      title: $('title').text(),
      description: $('meta[name="description"]').attr('content') || '',
      keywords: $('meta[name="keywords"]').attr('content') || ''
    });
  } catch (error) {
    console.error("Error fetching page context:", error);
    return '';
  }
}

async function generateQuickSharePosts(text: string, analysis: string) {
  const platforms = ['twitter', 'linkedin'];
  return Promise.all(
    platforms.map(platform => 
      craftPlatformPost(
        {
          summary: text,
          keyPoints: analysis.split('\n').filter(line => line.startsWith('- ')),
          learnings: "Quick capture from my learning journey"
        },
        platform as Platform,
        'minimal'
      )
    )
  );
}                                                                                                                       