import { z } from "zod";

export const CropRegionSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export type CropRegion = z.infer<typeof CropRegionSchema>;

export const QuestionExtractionRequestSchema = z.object({
  imageBase64: z.string().min(1, "Image base64 data is required"),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]).default("image/png"),
  crop: CropRegionSchema.optional(),
  userHint: z.string().optional(),
});

export type QuestionExtractionRequest = z.infer<typeof QuestionExtractionRequestSchema>;

export const QuestionExtractionResponseSchema = z.object({
  rawText: z.string(),
  cleanedQuestion: z.string(),
  codeSnippet: z.string().optional(),
  languageHint: z.string().optional(),
  confidence: z.number().min(0).max(1),
  ambiguities: z.array(z.string()).default([]),
  requiresUserCorrection: z.boolean().default(false),
});

export type QuestionExtractionResponse = z.infer<typeof QuestionExtractionResponseSchema>;

