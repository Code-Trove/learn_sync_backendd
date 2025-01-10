import express from "express";
import { SignUp, signIn } from "../controller/user-controller";

const router = express.Router();

router.post("/signup", SignUp);
router.post("/signin", signIn);
// router.post("/verify", verify);

export default router;
