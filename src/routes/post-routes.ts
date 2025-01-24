import express from "express";
import {
  craftPosts,
  craftThougts,
  postToTwitter,
  scheduledTweets,
} from "../controller/post-controller";
import { authenticate } from "../middleware/authenticate";

const router = express.Router();

router.post("/content/craft-posts", craftPosts);
router.post("/content/craft-thought", craftThougts);
router.post("/post/twitter", authenticate, postToTwitter);
router.post("/schedule/twitter", authenticate, scheduledTweets);

export default router;
