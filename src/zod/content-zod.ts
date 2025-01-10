import { z } from "zod";
import { ContentType } from "@prisma/client";

export const contentBody = z.object({
  link: z.string().url("Invalid URL format"),  // Content URL provided by user
  type: z.nativeEnum(ContentType),  // This ensures type is one of the ContentType enum values
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  category: z.string().optional(),
  userId: z.number(),
  tagIds: z.array(z.number())
});

export const shareSettingsBody = z.object({
  contentId: z.number(),
  isPublic: z.boolean(),
  sharedWithUserIds: z.array(z.number()).optional()
});

export type ContentInput = z.infer<typeof contentBody>;
export type ShareSettingsInput = z.infer<typeof shareSettingsBody>;
