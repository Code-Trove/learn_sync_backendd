import express, { Request, Response } from "express";
import { searchContentController } from "../controller/search-controller"; // Adjust the path as needed
import { authenticate } from "../middleware/authenticate";
import { User } from "@prisma/client";
import { chatWithUserController } from "../controller/chat-controller";

const router = express.Router();

type Query = {
  query: string;
};
// Route for searching content
router.get(
  "/search-content",
  authenticate,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const user = req.user as User;
      const userId = user.id;
      const { query } = req.query as Query;

      // Validate input
      if (!userId || !query) {
        return res.status(400).json({
          message:
            "Missing required fields: 'userId' and 'query' are mandatory.",
        });
      }

      // Call the controller to handle the request
      const results = await searchContentController(userId, query);

      // Respond with the results
      return res.status(200).json({
        message: "Search completed successfully.",
        results,
      });
    } catch (error: any) {
      console.error("Error in /search-content route:", error.message);

      return res.status(500).json({
        message: "An error occurred while processing your request.",
        error: error.message,
      });
    }
  }
);

router.post("/chat-with-us", authenticate, chatWithUserController);

export default router;
