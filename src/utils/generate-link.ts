import jwt from "jsonwebtoken";
// import contentModel from "../model/content";
import crypto from 'crypto';

const SECRET_KEY = "Link_Secret_key";

export const generateShareableLink = async (
  contentId: string
): Promise<string> => {
  const token = jwt.sign({ contentId }, SECRET_KEY, { expiresIn: "7d" });
  return `http://localhost:3000/share/${token}`;
};

export const generateUniqueLink = () => {
  // Generate a random string of 10 characters
  return crypto.randomBytes(10).toString('hex');
};
