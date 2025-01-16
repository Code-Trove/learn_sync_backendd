import cron from "node-cron";
import { PrismaClient } from "@prisma/client"; // Adjust path to your Prisma client
import OAuth from "oauth-1.0a";
import crypto from "crypto";
import fetch from "node-fetch";

const prisma = new PrismaClient();

// OAuth instance
const oauth = new OAuth({
  consumer: {
    key: process.env.TWITTER_CONSUMER_KEY!,
    secret: process.env.TWITTER_CONSUMER_SECRET!,
  },
  signature_method: "HMAC-SHA1",
  hash_function(baseString, key) {
    return crypto.createHmac("sha1", key).update(baseString).digest("base64");
  },
});

export const scheduleTweets = () => {
  cron.schedule("* * * * *", async () => {
    console.log("Running cron job for scheduled tweets...");

    try {
      const now = new Date();

      // Fetch PENDING tweets that are due to be posted
      const scheduledTweets = await prisma.scheduledTweet.findMany({
        where: {
          status: "PENDING",
          scheduled_time: {
            lte: now,
          },
        },
      });

      for (const tweet of scheduledTweets) {
        const { twitter_token, twitter_secret, content, id } = tweet;

        // Ensure token and secret are valid
        if (!twitter_token || !twitter_secret) {
          console.error("Missing Twitter credentials.");
          await prisma.scheduledTweet.update({
            where: { id },
            data: { status: "FAILED" },
          });
          continue;
        }

        const token = {
          key: twitter_token,
          secret: twitter_secret,
        };

        const request_data = {
          url: "https://api.twitter.com/2/tweets",
          method: "POST",
        };

        const authHeader = oauth.toHeader(oauth.authorize(request_data, token));

        try {
          const response = await fetch(request_data.url, {
            method: request_data.method,
            headers: {
              ...authHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ text: content }),
          });

          const responseData = await response.json();

          if (response.ok) {
            console.log(`Tweet posted successfully: ${content}`);
            await prisma.scheduledTweet.update({
              where: { id },
              data: { status: "POSTED" },
            });
          } else {
            console.error(
              `Failed to post tweet: ${JSON.stringify(responseData)}`
            );
            await prisma.scheduledTweet.update({
              where: { id },
              data: { status: "FAILED" },
            });
          }
        } catch (error) {
          console.error("Error posting tweet:", error);
          await prisma.scheduledTweet.update({
            where: { id },
            data: { status: "FAILED" },
          });
        }
      }
    } catch (error) {
      console.error("Error in cron job:", error);
    }
  });
};
