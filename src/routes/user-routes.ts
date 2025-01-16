import express from "express";
import passport from "passport";
import request from "request";
import OAuth from "oauth-1.0a";
import crypto from "crypto";
import { Request as ExpressRequest, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { signIn, SignUp } from "../controller/user-controller";
import { authenticate } from "../middleware/authenticate";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const router = express.Router();

router.post("/auth/signup", SignUp);
router.post("/auth/signin", signIn);
router.get("/auth/linkedin", passport.authenticate("linkedin"));

router.get(
  "/auth/linkedin/callback",
  passport.authenticate("linkedin", { failureRedirect: "/" }),
  (req, res) => {
    // Successful authentication, redirect home.
    res.redirect("/");
  }
);
interface OAuthResponse {
  response: any;
  body: string;
}

interface TwitterAccessTokenRequest {
  oauthToken: string;
  oauthVerifier: string;
  state: string;
}

interface OAuthResponse {
  response: any;
  body: string;
}

router.get("/auth/twitter/request-token", async (req: Request, res: any) => {
  try {
    if (
      !process.env.TWITTER_CONSUMER_KEY ||
      !process.env.TWITTER_CONSUMER_SECRET ||
      !process.env.EXTENSION_ID
    ) {
      throw new Error("Required environment variables are missing");
    }

    // Use the correct chrome-extension:// protocol for the callback URL
    const callbackUrl = "https://solor-system-rho.vercel.app/";

    const oauth = new OAuth({
      consumer: {
        key: process.env.TWITTER_CONSUMER_KEY,
        secret: process.env.TWITTER_CONSUMER_SECRET,
      },
      signature_method: "HMAC-SHA1",
      hash_function(base_string: string, key: string) {
        return crypto
          .createHmac("sha1", key)
          .update(base_string)
          .digest("base64");
      },
    });

    const state = crypto.randomBytes(32).toString("hex");

    const request_data = {
      url: "https://api.twitter.com/oauth/request_token",
      method: "POST",
      data: {
        oauth_callback: callbackUrl,
      },
    };

    // Log the callback URL for verification
    console.log("Using callback URL:", callbackUrl);

    const headers = oauth.toHeader(oauth.authorize(request_data));

    const response = await new Promise<OAuthResponse>((resolve, reject) => {
      request.post(
        {
          url: request_data.url,
          headers: headers,
          form: request_data.data,
        },
        (err, response, body) => {
          if (err) {
            console.error("Request error:", err);
            reject(err);
          } else {
            console.log("Raw response:", body);
            resolve({ response, body });
          }
        }
      );
    });

    if (response.response.statusCode !== 200) {
      console.error("Twitter API Error Response:", response.body);
      throw new Error(`Twitter API error: ${response.body}`);
    }

    const parsedBody = new URLSearchParams(response.body);
    const oauthToken = parsedBody.get("oauth_token");
    const oauthTokenSecret = parsedBody.get("oauth_token_secret");

    if (!oauthToken || !oauthTokenSecret) {
      throw new Error("Failed to obtain oauth tokens");
    }

    await prisma.oAuthState.create({
      data: {
        state,
        oauthToken,
        oauthTokenSecret,
        expiresAt: new Date(Date.now() + 1000 * 60 * 5),
      },
    });

    // Construct the authorization URL
    const authUrl = new URL("https://api.twitter.com/oauth/authorize");
    authUrl.searchParams.append("oauth_token", oauthToken);

    res.json({
      success: true,
      oauthToken,
      state,
      authUrl: authUrl.toString(),
    });
  } catch (error) {
    console.error("Error in request token:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
});
type TypedRequest<T> = ExpressRequest & {
  body: T;
};

type AuthenticatedUser = {
  id: number;
  email?: string | null;
  name: string;
  username?: string | null;
  twitterId?: string | null;
  twitterToken?: string | null;
  twitterSecret?: string | null;
  linkedinId?: string | null;
  linkedinToken?: string | null;
};
router.post(
  "/auth/twitter/access-token",
  authenticate,
  async (req: TypedRequest<TwitterAccessTokenRequest>, res: any) => {
    const { oauthVerifier, oauthToken, state } = req.body;
    console.log("req.body in access token flow:", req.body);

    try {
      // Extract authenticated user from middleware
      const authenticatedUser = req.user as AuthenticatedUser; // Assuming middleware sets `req.user`
      if (!authenticatedUser) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      // Validate state
      const storedState = await prisma.oAuthState.findFirst({
        where: {
          state,
          oauthToken,
          expiresAt: { gt: new Date() },
        },
      });

      if (!storedState) {
        throw new Error("Invalid or expired OAuth state");
      }

      // Create OAuth instance
      const oauth = new OAuth({
        consumer: {
          key: process.env.TWITTER_CONSUMER_KEY!,
          secret: process.env.TWITTER_CONSUMER_SECRET!,
        },
        signature_method: "HMAC-SHA1",
        hash_function(base_string: string, key: string) {
          return crypto
            .createHmac("sha1", key)
            .update(base_string)
            .digest("base64");
        },
      });

      // Prepare access token request
      const request_data = {
        url: "https://api.twitter.com/oauth/access_token",
        method: "POST",
        data: {
          oauth_token: oauthToken,
          oauth_verifier: oauthVerifier,
        },
      };

      const headers = oauth.toHeader(oauth.authorize(request_data));

      // Make the request to get the access token
      const response = await new Promise<string>((resolve, reject) => {
        request.post(
          {
            url: request_data.url,
            headers: headers,
            form: request_data.data,
          },
          (err, response, body) => {
            if (err) reject(err);
            else resolve(body);
          }
        );
      });

      // Parse the response
      const params = new URLSearchParams(response);
      const token = params.get("oauth_token");
      const tokenSecret = params.get("oauth_token_secret");
      const userId = params.get("user_id");
      const screenName = params.get("screen_name");

      if (!userId || !token || !tokenSecret) {
        throw new Error("Missing required OAuth parameters");
      }

      // Clean up state
      await prisma.oAuthState.delete({
        where: { id: storedState.id },
      });

      // Update the user with Twitter data
      await prisma.user.update({
        where: { id: authenticatedUser.id }, // Using `id` from authenticated user
        data: {
          twitterId: userId,
          twitterToken: token,
          twitterSecret: tokenSecret,
          username: screenName || authenticatedUser.username, // Preserve existing name if screenName is absent
        },
      });

      res.json({ success: true, userId, screenName });
    } catch (error) {
      console.error("Error in access token flow:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  }
);
const oauth = new OAuth({
  consumer: {
    key: process.env.TWITTER_CONSUMER_KEY!, // Your API Key
    secret: process.env.TWITTER_CONSUMER_SECRET!, // Your API Secret
  },
  signature_method: "HMAC-SHA1",
  hash_function(base_string, key) {
    return crypto.createHmac("sha1", key).update(base_string).digest("base64");
  },
});

router.post("/post/twitter", authenticate, async (req: any, res: any) => {
  try {
    const user = req.user;
    const { content } = req.body;
    console.log("User:", user);

    if (!user || !user.twitterToken || !user.twitterSecret) {
      return res.status(400).json({
        success: false,
        error: "Twitter not connected or missing credentials.",
      });
    }
    // Add this before making the request
    console.log("OAuth Config:", {
      consumerKey: process.env.TWITTER_CONSUMER_KEY!,
      hasConsumerSecret: process.env.TWITTER_CONSUMER_SECRET!
        ? "**present**"
        : "**missing**",
      tokenKey: user.twitterToken,
      hasTokenSecret: !!user.twitterSecret,
    });

    const request_data = {
      url: "https://api.twitter.com/2/tweets",
      method: "POST",
    };

    // Generate OAuth headers
    const token = {
      key: user.twitterToken, // OAuth Token
      secret: user.twitterSecret, // OAuth Token Secret
    };
    console.log("Token:", token);

    const authHeader = oauth.toHeader(oauth.authorize(request_data, token));
    console.log("Auth Header:", authHeader);

    const response = await fetch(request_data.url, {
      method: request_data.method,
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: content }),
    });

    const responseData = await response.json();
    console.log("Response:", responseData);

    if (!response.ok) {
      console.error("Twitter API Error:", responseData);
      return res.status(response.status).json({
        success: false,
        error: responseData.detail || "Failed to post tweet.",
      });
    }

    res.json({
      success: true,
      message: "Tweet posted successfully!",
      data: responseData,
    });
  } catch (error) {
    console.error("Error posting tweet:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

router.post("/schedule/twitter", authenticate, async (req: any, res: any) => {
  try {
    const user = req.user; // Get user from req.user (already authenticated)
    const { content, scheduledTime } = req.body; // Extract content and scheduledTime from the body

    // Validate user and Twitter credentials
    if (!user || !user.twitterToken || !user.twitterSecret) {
      return res.status(400).json({
        success: false,
        error: "Twitter not connected or missing credentials.",
      });
    }

    // Insert the scheduled tweet into the database
    const scheduledTweet = await prisma.scheduledTweet.create({
      data: {
        user_id: user.id, // Use the authenticated user's ID
        content: content,
        twitter_token: user.twitterToken,
        twitter_secret: user.twitterSecret,
        scheduled_time: new Date(scheduledTime),
        status: "PENDING",
      },
    });

    res.status(201).json({
      success: true,
      message: "Tweet scheduled successfully!",
      data: scheduledTweet,
    });
  } catch (error) {
    console.error("Error scheduling tweet:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

export default router;
