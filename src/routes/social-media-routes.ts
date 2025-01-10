import express from "express";
import { generateSocialPosts, previewPost } from "../controller/social-media-controller";

const router = express.Router();

router.post("/social/generate", generateSocialPosts);
router.post("/social/preview", previewPost);

export default router; 