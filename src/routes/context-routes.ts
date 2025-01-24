import express from "express";
import {
  captureContext,
  getContextsForContent,
  quickCapture,
} from "../controller/context-controller";
import { authenticate } from "../middleware/authenticate";

const router = express.Router();

router.post("/context", captureContext);
router.get("/content/:contentId/contexts", getContextsForContent);
router.post("/quick-capture", authenticate, quickCapture);

export default router;
