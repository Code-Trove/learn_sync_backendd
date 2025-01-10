import { z } from "zod";

export const requiredBody = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signInBody = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const userIdParam = z.number();

export type SignUpInput = z.infer<typeof requiredBody>;
export type SignInInput = z.infer<typeof signInBody>;
