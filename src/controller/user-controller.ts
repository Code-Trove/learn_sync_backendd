import { Request, Response } from "express";
import { requiredBody, signInBody } from "../zod/user-zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const SignUp = async (req: Request, res: Response): Promise<void> => {
  try {
    const parseDataWithSuccess = requiredBody.safeParse(req.body);
    if (!parseDataWithSuccess.success) {
      res.json({
        message: "Incorrect Format",
      });
      return;
    }

    const { name, email, password } = req.body;
    
    // Check if user exists using Prisma
    const findUserExist = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    const hashedPassword = await bcrypt.hash(password, 10);

    if (findUserExist) {
      res.status(409).json({
        message: "Email already exists, try to use another email",
        success: false,
      });
    } else {
      // Create user using Prisma
      const response = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      });

      // Remove password from response
      const { password: _, ...userWithoutPassword } = response;

      res.status(201).json({
        message: "You are signed up",
        data: userWithoutPassword,
        success: true,
        err: {},
      });
    }
  } catch (error) {
    const err = error as Error;
    console.error(err.message);
    res.status(500).json({
      message: "Internal server error",
      success: false,
      error: err.message,
    });
  }
};

export const signIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const parseDataWithSuccess = signInBody.safeParse(req.body);
    if (!parseDataWithSuccess.success) {
      res.json({
        message: "Incorrect Format",
      });
      return;
    }

    const { email, password } = req.body;

    // Find user using Prisma
    const findUser = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    if (!findUser) {
      res.status(404).json({
        message: "User not found",
        success: false,
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, findUser.password);
    if (!isPasswordValid) {
      res.status(401).json({
        message: "Invalid email or password",
        success: false,
      });
      return;
    }

    const token = jwt.sign(
      { id: findUser.id, email: findUser.email },
      process.env.JWT_SECRET || "SSH_256_789",
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "Sign-in successful",
      success: true,
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal server error",
      success: false,
      error: (error as Error).message,
    });
  }
};

// Don't forget to add this when the server is shutting down
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
