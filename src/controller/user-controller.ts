import { Request, Response } from "express";
import { requiredBody, signInBody } from "../zod/user-zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import passport from "passport";
import request from "request";
import { Request as ExpressRequest } from "express";
import OAuth from "oauth-1.0a";
import crypto from "crypto";

const prisma = new PrismaClient();
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

export const SignUp = async (req: Request, res: Response): Promise<void> => {
  try {
    const parseDataWithSuccess = requiredBody.safeParse(req.body);
    if (!parseDataWithSuccess.success) {
      res.json({
        message: "Incorrect Format",
      });
      return;
    }

    const { name, email, password } = req.body;

    // Check if user exists using Prisma
    const findUserExist = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    const hashedPassword = await bcrypt.hash(password, 10);

    if (findUserExist) {
      res.status(409).json({
        message: "Email already exists, try to use another email",
        success: false,
      });
    } else {
      // Create user using Prisma
      const response = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      });

      // Remove password from response
      const { password: _, ...userWithoutPassword } = response;

      res.status(201).json({
        message: "You are signed up",
        data: userWithoutPassword,
        success: true,
        err: {},
      });
    }
  } catch (error) {
    const err = error as Error;
    console.error(err.message);
    res.status(500).json({
      message: "Internal server error",
      success: false,
      error: err.message,
    });
  }
};

export const signIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const parseDataWithSuccess = signInBody.safeParse(req.body);
    if (!parseDataWithSuccess.success) {
      res.json({
        message: "Incorrect Format",
      });
      return;
    }
    console.log(req.body);
    const { email, password } = req.body;

    // Find user using Prisma
    const findUser = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    if (!findUser) {
      res.status(404).json({
        message: "User not found",
        success: false,
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, findUser.password);

    if (!isPasswordValid) {
      res.status(401).json({
        message: "Invalid email or password",
        success: false,
      });
      return;
    }

    const token = jwt.sign(
      { id: findUser.id, email: findUser.email },
      process.env.JWT_SECRET || "SSH_256_789",
      { expiresIn: "12h" }
    );

    res.status(200).json({
      message: "Sign-in successful",
      success: true,
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal server error",
      success: false,
      error: (error as Error).message,
    });
  }
};

export const linkTwitterAccount = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      res.status(404).json({
        message: "User not found",
        success: false,
      });
      return;
    }

    // Proceed with Twitter authentication
    passport.authenticate("twitter")(req, res, () => {
      res.redirect("/auth/twitter");
    });
  } catch (error) {
    console.error("Error linking Twitter account:", error);
    res.status(500).json({
      message: "Error linking Twitter account",
      success: false,
      error: (error as Error).message,
    });
  }
};

export const RequestToken = async (req: Request, res: any): Promise<any> => {
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
};

export const AccessToken = async (
  req: TypedRequest<TwitterAccessTokenRequest>,
  res: any
) => {
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
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
};

// Don't forget to add this when the server is shutting down
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});
