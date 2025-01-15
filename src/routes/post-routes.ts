import express from "express";
import { authenticate } from "../middleware/authenticate";
import { postToTwitter } from "../controller/post-controller";

const router = express.Router();

router.post("/twitter", authenticate, postToTwitter);

export default router;
