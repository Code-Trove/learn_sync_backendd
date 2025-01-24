import express from "express";
import {
  addContent,
  getAllContent,
  shareWithUser,
  makeContentPublic,
  makeContentPrivate,
  accessSharedContent,
  searchContent,
  contentChat,
  contentSummarization,
} from "../controller/content-controller";
import { authenticate } from "../middleware/authenticate";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

router.post("/content/addContent", authenticate, addContent);
router.get("/get-content", getAllContent);
router.post("/share/user", shareWithUser);
router.post("/share/public", makeContentPublic);
router.post("/share/private", makeContentPrivate);
router.get("/shared/:hash", accessSharedContent);
router.get("/search", authenticate, searchContent);
router.get("/captures/recent", getAllContent);
router.post("/content/chat", contentChat);
router.post("/content/summary", contentSummarization);

// Local authentication routes

export default router;
