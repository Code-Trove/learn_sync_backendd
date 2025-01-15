import { Request, Response } from "express";

interface AuthenticatedRequest extends Request {
  user?: {
    twitterToken?: string;
    twitterSecret?: string;
    id?: string;
  };
}
import { PrismaClient } from "@prisma/client";
import request from "request";

const prisma = new PrismaClient();

export const postToTwitter = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const user = req.user;
  const { content } = req.body;

  if (!user || !user.twitterToken || !user.twitterSecret) {
    res.status(401).json({
      message: "User not authenticated with Twitter",
      success: false,
    });
    return;
  }

  request.post(
    {
      url: "https://api.twitter.com/1.1/statuses/update.json",
      oauth: {
        consumer_key: process.env.TWITTER_CONSUMER_KEY!,
        consumer_secret: process.env.TWITTER_CONSUMER_SECRET!,
        token: user.twitterToken,
        token_secret: user.twitterSecret,
      },
      form: { status: content },
    },
    (err, response, body) => {
      if (err) {
        res.status(500).json({ success: false, error: err.message });
        return;
      }

      res.json({ success: true, data: JSON.parse(body) });
    }
  );
};

// Add other post-related logic here as needed

// Don't forget to add this when the server is shutting down
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});
