import express from "express";
import {
  suggestRelationships,
  createRelationship,
  getRelatedContent
} from "../controller/relationship-controller";

const router = express.Router();

router.get("/content/:contentId/suggest-relations", suggestRelationships);
router.post("/content/relationships", createRelationship);
router.get("/content/:contentId/relations", getRelatedContent);

export default router; 