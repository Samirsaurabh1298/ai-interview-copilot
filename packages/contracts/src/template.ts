import { z } from "zod";
import { ToolPolicySchema } from "./assessment.js";

export const ChallengeDifficultySchema = z.enum(["junior", "mid", "senior", "staff"]);
export type ChallengeDifficulty = z.infer<typeof ChallengeDifficultySchema>;

export const TemplateStatusSchema = z.enum(["draft", "published", "archived"]);
export type TemplateStatus = z.infer<typeof TemplateStatusSchema>;

export const AssessmentTemplateSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  title: z.string().min(3).max(120),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
  description: z.string().min(10),
  targetRole: z.string().min(2).max(80),
  difficulty: ChallengeDifficultySchema.default("mid"),
  language: z.enum(["typescript", "javascript", "python"]).default("typescript"),
  durationMinutes: z.number().int().min(15).max(240).default(60),
  defaultAiBudgetUsd: z.number().min(0.05).max(5.0).default(0.25),
  starterCode: z.string().min(1),
  solutionCode: z.string().optional(),
  verificationTestCode: z.string().min(1),
  toolPolicy: ToolPolicySchema.default({
    allowedProvider: "openai",
    allowedModel: "gpt-4o-mini",
    maxBudgetUsd: 0.25,
    warningThresholdPercent: 80,
    timeLimitSeconds: 3600,
    allowInternetSearch: false,
    allowDocumentation: true,
  }),
  rubricDimensionWeights: z
    .record(z.string(), z.number().min(1).max(30))
    .default({
      "code-comprehension": 15,
      "problem-framing": 10,
      "ai-collaboration": 15,
      "critical-evaluation": 15,
      "debugging-implementation": 20,
      "testing-verification": 15,
      "explanation-judgment": 10,
    }),
  status: TemplateStatusSchema.default("draft"),
  createdByMemberId: z.string().optional(),
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
});
export type AssessmentTemplate = z.infer<typeof AssessmentTemplateSchema>;

export const CreateTemplateRequestSchema = z.object({
  organizationId: z.string(),
  title: z.string().min(3).max(120),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().min(10),
  targetRole: z.string().min(2).max(80),
  difficulty: ChallengeDifficultySchema.optional().default("mid"),
  language: z.enum(["typescript", "javascript", "python"]).optional().default("typescript"),
  durationMinutes: z.number().int().min(15).max(240).optional().default(60),
  defaultAiBudgetUsd: z.number().min(0.05).max(5.0).optional().default(0.25),
  starterCode: z.string().min(1),
  solutionCode: z.string().optional(),
  verificationTestCode: z.string().min(1),
  toolPolicy: ToolPolicySchema.optional(),
  rubricDimensionWeights: z.record(z.string(), z.number().min(1).max(30)).optional(),
});
export type CreateTemplateRequest = z.infer<typeof CreateTemplateRequestSchema>;

export const UpdateTemplateRequestSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().min(10).optional(),
  targetRole: z.string().min(2).max(80).optional(),
  difficulty: ChallengeDifficultySchema.optional(),
  language: z.enum(["typescript", "javascript", "python"]).optional(),
  durationMinutes: z.number().int().min(15).max(240).optional(),
  defaultAiBudgetUsd: z.number().min(0.05).max(5.0).optional(),
  starterCode: z.string().min(1).optional(),
  solutionCode: z.string().optional(),
  verificationTestCode: z.string().min(1).optional(),
  toolPolicy: ToolPolicySchema.optional(),
  rubricDimensionWeights: z.record(z.string(), z.number().min(1).max(30)).optional(),
  status: TemplateStatusSchema.optional(),
});
export type UpdateTemplateRequest = z.infer<typeof UpdateTemplateRequestSchema>;

