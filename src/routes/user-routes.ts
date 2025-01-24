import express from "express";
import passport from "passport";

import {
  signIn,
  SignUp,
  RequestToken,
  AccessToken,
} from "../controller/user-controller";
import { authenticate } from "../middleware/authenticate";

const router = express.Router();

router.post("/auth/signup", SignUp);
router.post("/auth/signin", signIn);
router.get("/auth/linkedin", passport.authenticate("linkedin"));
router.get("/auth/twitter/request-token", RequestToken);
router.post("/auth/twitter/access-token", authenticate, AccessToken);

export default router;
