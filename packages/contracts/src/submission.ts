import { z } from "zod";
import { SingleTestResultSchema } from "./validation.js";

// ==============================================================================
// Code Diff Summary Contract
// ==============================================================================

export const CodeDiffSummarySchema = z.object({
  additions: z.number().int().min(0),
  deletions: z.number().int().min(0),
  totalChanges: z.number().int().min(0),
  unifiedDiff: z.string(),
});

export type CodeDiffSummary = z.infer<typeof CodeDiffSummarySchema>;

// ==============================================================================
// Immutable Submission Artifact Schema (Task 14 / AD #9)
// ==============================================================================

export const SubmissionArtifactSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  organizationId: z.string(),
  templateId: z.string(),
  candidateName: z.string(),
  candidateEmail: z.string(),
  submittedAt: z.coerce.date(),
  finalCode: z.string(),
  starterCode: z.string(),
  codeDiff: CodeDiffSummarySchema,
  testExecutionLog: z.object({
    success: z.boolean(),
    passed: z.boolean(),
    passedCount: z.number().int(),
    totalCount: z.number().int(),
    durationMs: z.number(),
    tests: z.array(SingleTestResultSchema),
    stdout: z.string().optional(),
    stderr: z.string().optional(),
    exitCode: z.number().int(),
  }),
  technicalExplanation: z.string(),
  telemetrySummary: z.object({
    totalEvents: z.number().int(),
    aiQueriesCount: z.number().int(),
    consumedAiBudgetUsd: z.number(),
    patchDecisions: z.object({
      accepted: z.number().int(),
      rejected: z.number().int(),
    }),
    attentionMetrics: z.object({
      blurCount: z.number().int(),
      pasteCount: z.number().int(),
    }),
  }),
  templateContentHash: z.string(),
  submissionFingerprint: z.string(), // Canonical SHA-256 fingerprint
});

export type SubmissionArtifact = z.infer<typeof SubmissionArtifactSchema>;

// ==============================================================================
// Submission API Request & Response Contracts
// ==============================================================================

export const SubmitAssessmentRequestSchema = z.object({
  finalCode: z.string().min(1, "Final code cannot be empty"),
  technicalExplanation: z
    .string()
    .min(10, "Please provide a technical explanation of your changes (at least 10 characters)"),
});

export type SubmitAssessmentRequest = z.infer<typeof SubmitAssessmentRequestSchema>;

export const SubmitAssessmentResponseSchema = z.object({
  submissionId: z.string(),
  sessionId: z.string(),
  status: z.literal("submitted"),
  submittedAt: z.coerce.date(),
  submissionFingerprint: z.string(),
  artifact: SubmissionArtifactSchema,
});

export type SubmitAssessmentResponse = z.infer<typeof SubmitAssessmentResponseSchema>;

export const GetSubmissionResponseSchema = z.object({
  artifact: SubmissionArtifactSchema,
});

export type GetSubmissionResponse = z.infer<typeof GetSubmissionResponseSchema>;

