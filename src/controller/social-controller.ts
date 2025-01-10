import { Request, Response } from "express";
import OpenAI from 'openai';
import { craftPlatformPost, Platform } from '../utils/post-crafter';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ThoughtToPostRequest {
  thought: string;
  context?: string;
  selectedText?: string;
  url?: string;
  platforms: Platform[];
}

export const generateFromThought = async (req: Request, res: Response): Promise<void> => {
  try {
    const { thought, context, selectedText, url, platforms } = req.body as ThoughtToPostRequest;

    // First, enhance the thought with AI
    const enhancedContent = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You're an expert at understanding learning concepts and enhancing ideas."
        },
        {
          role: "user",
          content: `
            Context: ${context || 'No specific context'}
            Selected Text: ${selectedText || 'None'}
            URL: ${url || 'None'}
            User's Thought: ${thought}

            Please analyze this and provide:
            1. A clear understanding of the concept
            2. Key learning points
            3. Practical applications
            4. Any interesting insights
          `
        }
      ]
    });

    // Generate posts for each platform
    const posts = await Promise.all(
      platforms.map(platform => 
        craftPlatformPost(
          {
            summary: enhancedContent.choices[0].message.content || thought,
            keyPoints: [thought],
            learnings: thought
          },
          platform
        )
      )
    );

    res.status(200).json({
      message: "Posts generated successfully",
      data: {
        posts: Object.fromEntries(
          platforms.map((platform, index) => [platform, posts[index]])
        )
      },
      success: true
    });

  } catch (error) {
    console.error("Error generating posts:", error);
    res.status(500).json({
      message: "Error generating posts",
      success: false,
      error: (error as Error).message
    });
  }
};

// Chat and refine the post
export const chatAndRefinePost = async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, currentPost, platform } = req.body;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You're helping refine a ${platform} post. Maintain platform-specific formatting and constraints.`
        },
        {
          role: "user",
          content: `
            Current Post: ${currentPost}
            User's Request: ${message}
            
            Please help modify the post based on the user's request while keeping it optimized for ${platform}.
          `
        }
      ]
    });

    res.status(200).json({
      message: "Post refined successfully",
      data: {
        refinedPost: response.choices[0].message.content
      },
      success: true
    });

  } catch (error) {
    console.error("Error refining post:", error);
    res.status(500).json({
      message: "Error refining post",
      success: false,
      error: (error as Error).message
    });
  }
}; 