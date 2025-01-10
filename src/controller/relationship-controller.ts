import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface RelationshipRequest {
  contentId: number;
  relatedContentIds?: number[];
  topics?: string[];
  clusterId?: number;
  learningPathId?: number;
  order?: number;
}

export const suggestRelationships = async (req: Request, res: Response): Promise<void> => {
  try {
    const { contentId } = req.params;

    const content = await prisma.content.findUnique({
      where: { id: Number(contentId) },
      include: {
        contexts: true,
      }
    });

    if (!content) {
      res.status(404).json({ message: "Content not found" });
      return;
    }

    // Use AI to analyze content and suggest relationships
    const analysis = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You're an expert at analyzing content relationships and knowledge graphs."
        },
        {
          role: "user",
          content: `
            Analyze this content and suggest:
            1. Related topics
            2. Potential content clusters
            3. Learning path suggestions

            Content: ${content.extractedText}
            Context: ${content.contexts.map(c => c.userThought).join('\n')}
            Current Topics: ${content.keywords.join(', ')}
          `
        }
      ]
    });

    res.status(200).json({
      message: "Relationship suggestions generated",
      data: {
        suggestions: analysis.choices[0].message.content,
        content: content
      },
      success: true
    });

  } catch (error) {
    console.error("Error suggesting relationships:", error);
    res.status(500).json({
      message: "Error suggesting relationships",
      success: false,
      error: (error as Error).message
    });
  }
};

export const createRelationship = async (req: Request, res: Response): Promise<void> => {
  try {
    const { contentId, relatedContentIds, topics, clusterId, learningPathId, order } = req.body as RelationshipRequest;

    // Create or connect topics
    if (topics) {
      await Promise.all(topics.map(async (topic) => {
        await prisma.topic.upsert({
          where: { name: topic },
          update: {
            contents: {
              connect: { id: contentId }
            }
          },
          create: {
            name: topic,
            contents: {
              connect: { id: contentId }
            }
          }
        });
      }));
    }

    // Connect related content
    if (relatedContentIds) {
      await prisma.content.update({
        where: { id: contentId },
        data: {
          relatedFrom: {
            connect: relatedContentIds.map(id => ({ id }))
          }
        }
      });
    }

    // Add to cluster
    if (clusterId) {
      await prisma.content.update({
        where: { id: contentId },
        data: {
          clusters: {
            connect: { id: clusterId }
          }
        }
      });
    }

    // Add to learning path
    if (learningPathId) {
      await prisma.content.update({
        where: { id: contentId },
        data: {
          learningPath: {
            connect: { id: learningPathId }
          },
          pathOrder: order
        }
      });
    }

    res.status(200).json({
      message: "Relationships created successfully",
      success: true
    });

  } catch (error) {
    console.error("Error creating relationships:", error);
    res.status(500).json({
      message: "Error creating relationships",
      success: false,
      error: (error as Error).message
    });
  }
};

export const getRelatedContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { contentId } = req.params;

    const content = await prisma.content.findUnique({
      where: { id: Number(contentId) },
      include: {
        relatedTo: true,
        relatedFrom: true,
        topics: true,
        clusters: {
          include: {
            contents: true
          }
        },
        learningPath: {
          include: {
            contents: true
          }
        }
      }
    });

    if (!content) {
      res.status(404).json({ message: "Content not found" });
      return;
    }

    res.status(200).json({
      message: "Related content retrieved successfully",
      data: {
        directRelations: [...content.relatedTo, ...content.relatedFrom],
        topics: content.topics,
        clusters: content.clusters,
        learningPath: content.learningPath
      },
      success: true
    });

  } catch (error) {
    console.error("Error retrieving related content:", error);
    res.status(500).json({
      message: "Error retrieving related content",
      success: false,
      error: (error as Error).message
    });
  }
}; 