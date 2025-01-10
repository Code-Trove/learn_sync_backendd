import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type Platform = 'linkedin' | 'twitter' | 'facebook' | 'instagram';
export type PostStyle = 'professional' | 'casual' | 'technical' | 'minimal' | 'thread';

interface PlatformConfig {
  maxLength: number;
  hashtagLimit: number;
  style: string;
}

const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  linkedin: {
    maxLength: 3000,
    hashtagLimit: 5,
    style: "professional, engaging, with clear formatting"
  },
  twitter: {
    maxLength: 280,
    hashtagLimit: 3,
    style: "concise, punchy, with engaging hooks"
  },
  facebook: {
    maxLength: 63206,
    hashtagLimit: 3,
    style: "conversational and engaging"
  },
  instagram: {
    maxLength: 2200,
    hashtagLimit: 30,
    style: "visual-focused with emojis and line breaks"
  }
};

export async function craftPlatformPost(
  content: {
    summary: string;
    keyPoints: string[];
    learnings: string;
  },
  platform: Platform,
  style: PostStyle = 'professional'
): Promise<string> {
  const config = PLATFORM_CONFIGS[platform];
  
  const prompt = `
    Craft a ${platform} post about this learning/content.
    Style: ${style}
    Max Length: ${config.maxLength} characters
    Hashtag Limit: ${config.hashtagLimit}
    Platform Style: ${config.style}

    Content Summary: ${content.summary}
    Key Points: ${content.keyPoints.join(', ')}
    Personal Learning: ${content.learnings}

    Requirements:
    1. Must fit platform's character limit
    2. Include appropriate hashtags
    3. Use platform-specific formatting
    4. Make it engaging and shareable
    5. Include a call to action
    ${platform === 'twitter' && style === 'thread' ? '6. Format as a thread with 🧵' : ''}
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are an expert social media content creator for ${platform}. Create engaging, platform-optimized content.`
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.7,
  });

  return response.choices[0].message.content || '';
} 