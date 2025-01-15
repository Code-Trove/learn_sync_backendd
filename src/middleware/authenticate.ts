import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  const authHeader = req.headers.authorization;
  console.log(authHeader);

  if (!authHeader) {
    return res.status(401).json({
      message: "Access denied. No token provided.",
      success: false,
    });
  }

  const token = authHeader.split(" ")[1];

  console.log("token", token);
  if (!token) {
    return res.status(401).json({
      message: "Access denied. No token provided.",
      success: false,
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "SSH_256_789"
    ) as { id: number; email: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user) {
      return res.status(401).json({
        message: "Invalid token.",
        success: false,
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.log(error);
    res.status(400).json({
      message: "Invalid token.",
      success: false,
    });
  }
};
