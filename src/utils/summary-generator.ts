import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ContentSummary {
  tldr: string;
  keyPoints: string[];
  suggestedTags: string[];
  relatedTopics: string[];
}

export type SummaryStyle = 'professional' | 'casual' | 'technical' | 'educational' | 'creative';

const STYLE_PROMPTS = {
  professional: "Provide a formal, business-oriented summary focusing on key insights and actionable points.",
  casual: "Give me a friendly, conversational summary as if explaining to a friend.",
  technical: "Create a detailed technical summary with specific terminology and implementation details.",
  educational: "Explain this content in a teaching style with clear examples and explanations.",
  creative: "Summarize this creatively, using analogies and engaging language."
};

export async function generateContentSummary(
  content: {
    title: string;
    extractedText: string;
    metadata: any;
    keywords: string[];
  },
  style: SummaryStyle = 'professional'
): Promise<ContentSummary> {
  try {
    const prompt = `
      Analyze the following content and provide a structured summary.
      Style: ${STYLE_PROMPTS[style]}
      
      Title: ${content.title}
      Content: ${content.extractedText}
      Keywords: ${content.keywords.join(', ')}
      
      Please provide:
      1. A TLDR (2-3 sentences)
      2. 3-5 key points
      3. 5 suggested tags/topics
      4. 3 related topics for further exploration
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert content analyst and summarizer. Provide clear, insightful summaries in the requested style."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
    });

    // Parse the response
    const output = response.choices[0].message.content || '';
    const sections = output.split('\n\n');

    return {
      tldr: sections[0].replace('TLDR: ', '').trim(),
      keyPoints: sections[1].split('\n').filter(line => line.startsWith('-')).map(point => point.slice(2)),
      suggestedTags: sections[2].split(',').map(tag => tag.trim()),
      relatedTopics: sections[3].split(',').map(topic => topic.trim())
    };
  } catch (error) {
    console.error('Error generating summary:', error);
    return {
      tldr: "Failed to generate summary",
      keyPoints: [],
      suggestedTags: [],
      relatedTopics: []
    };
  }
} 