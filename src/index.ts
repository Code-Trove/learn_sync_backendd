import express, { Express } from "express";
import userRoutes from "./routes/user-routes";
import contentRoutes from "./routes/content-routes";
import contextRoutes from "./routes/context-routes";
import relationshipRoutes from "./routes/relationship-routes";
import bodyParser from "body-parser";
import { PrismaClient } from "@prisma/client";
import { scheduleTweets } from "./jobs/tweetScheduler";
import cors from "cors";

const prisma = new PrismaClient();
const app: Express = express();

// Increase payload limit for large text
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

app.use(
  cors({
    origin: "*", // Or specify your frontend origin here, like 'https://chatgpt.com'
    credentials: true, // Allow credentials like cookies, authorization headers
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Callback-Url"],
  })
);

app.options("*", cors()); // Allow preflight requests

// Health check endpoint
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Register all routes with error handling
const registerRoute = (path: string, router: express.Router) => {
  app.use(path, (req, res, next) => {
    try {
      router(req, res, next);
    } catch (error) {
      console.error(`Error in ${path}:`, error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  });
};

registerRoute("/api/v1", userRoutes);
registerRoute("/api/v1", contentRoutes);
registerRoute("/api/v1", contextRoutes);
registerRoute("/api/v1", relationshipRoutes);

// Global error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Global error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
);

async function startServer() {
  try {
    await prisma.$connect();
    console.log("Successfully connected to database");

    scheduleTweets();

    const port = process.env.PORT || 3125;
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

export { prisma };
