import { z } from "zod";
import { SingleTestResultSchema } from "./validation.js";

// ==============================================================================
// Assessment Tool Policy & Budget Contract (Section 51)
// ==============================================================================

export const ToolPolicySchema = z.object({
  allowedProvider: z.enum(["openai", "anthropic", "google", "groq", "grok", "mock"]).default("groq"),
  allowedModel: z.string().default("qwen/qwen3.8-27b"),
  maxBudgetUsd: z.number().positive().default(0.25), // $0.25 pilot target
  warningThresholdPercent: z.number().min(50).max(95).default(80), // 80% warning
  timeLimitSeconds: z.number().int().positive().default(3600), // 60 minutes
  allowInternetSearch: z.boolean().default(false),
  allowDocumentation: z.boolean().default(true),
});

export type ToolPolicy = z.infer<typeof ToolPolicySchema>;

export const SessionBudgetStatusSchema = z.object({
  maxBudgetUsd: z.number(),
  consumedBudgetUsd: z.number(),
  remainingBudgetUsd: z.number(),
  percentUsed: z.number().min(0).max(100),
  isWarningTriggered: z.boolean(),
  isExhausted: z.boolean(),
});

export type SessionBudgetStatus = z.infer<typeof SessionBudgetStatusSchema>;

// ==============================================================================
// 7-Dimension Rubric Scoring Contract (Sections 29, 44, 51.7)
// ==============================================================================

export const RubricDimensionIdSchema = z.enum([
  "code-comprehension",
  "problem-framing",
  "ai-collaboration",
  "critical-evaluation",
  "debugging-implementation",
  "testing-verification",
  "explanation-judgment",
]);

export type RubricDimensionId = z.infer<typeof RubricDimensionIdSchema>;

export const RubricRatingAnchorSchema = z.union([
  z.literal(1), // Insufficient evidence
  z.literal(2), // Developing
  z.literal(3), // Effective
  z.literal(4), // Strong
]);

export type RubricRatingAnchor = z.infer<typeof RubricRatingAnchorSchema>;

export const RubricDimensionScoreSchema = z.object({
  dimensionId: RubricDimensionIdSchema,
  name: z.string(),
  weight: z.number().min(0).max(100),
  rating: RubricRatingAnchorSchema,
  points: z.number().min(0).max(100),
  evidenceCitations: z.array(z.string()).default([]),
  reviewerNotes: z.string().optional(),
  isNotApplicable: z.boolean().optional(),
});

export type RubricDimensionScore = z.infer<typeof RubricDimensionScoreSchema>;

export const AssessmentScorecardSchema = z.object({
  sessionId: z.string(),
  candidateId: z.string(),
  rubricVersion: z.string().default("1.0.0"),
  dimensions: z.array(RubricDimensionScoreSchema),
  weightedTotalScore: z.number().min(0).max(100),
  scoringMethod: z.enum(["ai_draft", "human_verified", "calibrated"]),
  reviewerId: z.string().optional(),
  summaryNotes: z.string(),
  createdAt: z.coerce.date().default(() => new Date()),
});

export type AssessmentScorecard = z.infer<typeof AssessmentScorecardSchema>;

// ==============================================================================
// Candidate Submission Contract (Section 42 & 46)
// ==============================================================================

export const CandidateSubmissionSchema = z.object({
  sessionId: z.string(),
  candidateId: z.string(),
  finalCode: z.string(),
  diff: z.string().optional(),
  explanation: z.string().min(1, "Candidate explanation is required"),
  testResults: z.array(SingleTestResultSchema).default([]),
  submittedAt: z.coerce.date().default(() => new Date()),
});

export type CandidateSubmission = z.infer<typeof CandidateSubmissionSchema>;

