import express from "express";
import { captureContext, getContextsForContent } from "../controller/context-controller";

const router = express.Router();

router.post("/context", captureContext);
router.get("/content/:contentId/contexts", getContextsForContent);

export default router; 