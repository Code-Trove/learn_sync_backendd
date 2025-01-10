import Tesseract from 'tesseract.js';
import fetch from 'node-fetch';
import { OpenAI } from 'openai';

// Extract text from image
export async function extractTextFromImage(imageUrl: string): Promise<string> {
  try {
    const result = await Tesseract.recognize(
      imageUrl,
      'eng',
      { 
        logger: m => console.log(m),
      }
    );

    let text = result.data.text;
    text = text
      .replace(/[^\S\r\n]+/g, ' ')
      .replace(/[\r\n]+/g, '\n')
      .trim();

    return text;
  } catch (error) {
    console.error('Error extracting text:', error);
    return '';
  }
}

// Analyze image for content using OpenAI Vision
export async function analyzeImage(imageUrl: string) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this image and provide topics and labels." },
            { 
              type: "image_url", 
              image_url: { url: imageUrl }
            }
          ],
        },
      ],
      max_tokens: 300,
    });

    const analysis = response.choices[0].message.content || '';
    const topics = analysis.split('\n').filter(line => line.trim());
    const labels = topics.map(topic => topic.split(':')[0].trim());

    return {
      topics,
      labels
    };
  } catch (error) {
    console.error('Error analyzing image:', error);
    return {
      topics: [],
      labels: []
    };
  }
}

// Add to package.json:
// {
//   "dependencies": {
//     "tesseract.js": "^4.1.1",
//     "@tensorflow/tfjs-node": "^4.17.0",
//     "node-fetch": "^2.7.0"
//   }
// } 