import { z } from "zod";
import { PracticeTrackSchema, PracticeDifficultySchema } from "./practice.js";
import { CropRegionSchema } from "./extraction.js";

export const ScreenCaptureIngestRequestSchema = z.object({
  imageBase64: z.string().min(1, "Image base64 data or data URL is required"),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]).default("image/png"),
  crop: CropRegionSchema.optional(),
  userHint: z.string().optional(),
  targetLanguage: z.enum(["typescript", "javascript", "python"]).default("typescript"),
  trackHint: PracticeTrackSchema.optional(),
});

export type ScreenCaptureIngestRequest = z.infer<typeof ScreenCaptureIngestRequestSchema>;

export const ExtractedChallengeTestCaseSchema = z.object({
  name: z.string(),
  input: z.string(),
  expectedOutput: z.string(),
  isHidden: z.boolean().default(false),
});

export type ExtractedChallengeTestCase = z.infer<typeof ExtractedChallengeTestCaseSchema>;

export const ExtractedChallengeResponseSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  track: PracticeTrackSchema,
  difficulty: PracticeDifficultySchema,
  timeLimitMinutes: z.number().int().positive().default(45),
  description: z.string().min(1),
  starterCode: z.string(),
  solutionCode: z.string().optional(),
  testCases: z.array(ExtractedChallengeTestCaseSchema).default([]),
  testHarnessCode: z.string(),
  hints: z.array(z.string()).default([]),
  confidenceScore: z.number().min(0).max(1),
  detectedSource: z.string().default("Unknown Problem Document"),
  rawOcrText: z.string().optional(),
});

export type ExtractedChallengeResponse = z.infer<typeof ExtractedChallengeResponseSchema>;

