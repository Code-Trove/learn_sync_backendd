// src/types/custom.d.ts
import "express-session";

declare module "express-session" {
  interface SessionData {
    oauthToken: string;
    oauthTokenSecret: string;
    userId: string;
  }
}

// Adjust the path accordingly

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser; // The authenticated user is optional
    }
  }
}
