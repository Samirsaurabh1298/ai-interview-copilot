import { z } from "zod";
import { RubricDimensionIdSchema, RubricRatingAnchorSchema } from "./assessment.js";
import { HiringRecommendationSchema } from "./calibration.js";
import { ProgrammingLanguageSchema } from "./validation.js";

// ==============================================================================
// Practice Track & Difficulty Schemas
// ==============================================================================

export const PracticeTrackSchema = z.enum([
  "frontend",
  "backend",
  "fullstack",
  "systems",
  "algorithms",
]);
export type PracticeTrack = z.infer<typeof PracticeTrackSchema>;

export const PracticeDifficultySchema = z.enum([
  "junior",
  "mid",
  "senior",
  "staff",
]);
export type PracticeDifficulty = z.infer<typeof PracticeDifficultySchema>;

// ==============================================================================
// Practice Challenge Schema
// ==============================================================================

export const PracticeChallengeSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  track: PracticeTrackSchema,
  difficulty: PracticeDifficultySchema,
  language: ProgrammingLanguageSchema.default("typescript"),
  estimatedMinutes: z.number().int().min(10).max(180).default(45),
  description: z.string().min(20),
  starterCode: z.string(),
  verificationTestCode: z.string(),
  solutionTemplate: z.string().optional(),
  hints: z.array(z.string()).default([]),
  simulatedAiBudgetUsd: z.number().min(0.05).max(5.0).default(0.25),
  tags: z.array(z.string()).default([]),
});
export type PracticeChallenge = z.infer<typeof PracticeChallengeSchema>;

// ==============================================================================
// Practice Submission Request Schema
// ==============================================================================

export const PracticeSubmissionRequestSchema = z.object({
  challengeId: z.string(),
  candidateCode: z.string().min(1, "Candidate code cannot be empty"),
  technicalExplanation: z.string().min(10, "Technical explanation must be at least 10 characters"),
  elapsedSeconds: z.number().int().min(0),
  aiQueriesCount: z.number().int().min(0).default(0),
  aiBudgetConsumedUsd: z.number().min(0).default(0),
  patchesAccepted: z.number().int().min(0).default(0),
  patchesRejected: z.number().int().min(0).default(0),
  testRunsCount: z.number().int().min(0).default(0),
  testResults: z.object({
    passed: z.number().int().min(0),
    total: z.number().int().min(0),
    durationMs: z.number().min(0),
    tests: z.array(
      z.object({
        name: z.string(),
        passed: z.boolean(),
        durationMs: z.number(),
        error: z.string().optional(),
      })
    ).default([]),
  }),
});
export type PracticeSubmissionRequest = z.infer<typeof PracticeSubmissionRequestSchema>;

// ==============================================================================
// Practice Feedback Dimension Schema
// ==============================================================================

export const PracticeFeedbackDimensionSchema = z.object({
  dimensionId: RubricDimensionIdSchema,
  name: z.string(),
  rating: RubricRatingAnchorSchema,
  weight: z.number().min(5).max(40),
  weightedScore: z.number().min(0).max(100),
  levelLabel: z.enum(["Developing", "Competent", "Advanced", "Exemplary"]),
  rationale: z.string(),
  keyStrengths: z.array(z.string()).default([]),
  growthAreas: z.array(z.string()).default([]),
});
export type PracticeFeedbackDimension = z.infer<typeof PracticeFeedbackDimensionSchema>;

// ==============================================================================
// Practice Feedback Diagnostic Card Schema
// ==============================================================================

export const PracticeFeedbackCardSchema = z.object({
  id: z.string(),
  challengeId: z.string(),
  challengeTitle: z.string(),
  track: PracticeTrackSchema,
  difficulty: PracticeDifficultySchema,
  compositeScore: z.number().min(0).max(100),
  recommendation: HiringRecommendationSchema,
  submittedAt: z.coerce.date().default(() => new Date()),
  dimensions: z.array(PracticeFeedbackDimensionSchema).length(7),
  aiRelianceIndex: z.object({
    score: z.number().min(0).max(100),
    label: z.enum([
      "Autonomous Coder",
      "Balanced AI Collaborator",
      "Over-Reliant on Suggestions",
      "Critical & Methodical Reviewer",
    ]),
    patchesAccepted: z.number().int().min(0),
    patchesRejected: z.number().int().min(0),
    scrutinyRatio: z.number().min(0),
    queriesCount: z.number().int().min(0),
  }),
  speedAndPrecision: z.object({
    elapsedMinutes: z.number(),
    timeAllocatedMinutes: z.number(),
    testPassRatePercent: z.number().min(0).max(100),
    testsPassed: z.number().int().min(0),
    testsTotal: z.number().int().min(0),
  }),
  executiveSummary: z.string(),
  actionableTakeaways: z.array(z.string()).default([]),
  recommendedNextChallenges: z.array(z.string()).default([]),
});
export type PracticeFeedbackCard = z.infer<typeof PracticeFeedbackCardSchema>;

