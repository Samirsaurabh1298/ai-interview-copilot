import { z } from "zod";
import { RubricDimensionIdSchema, RubricRatingAnchorSchema } from "./assessment.js";
import { HiringRecommendationSchema, ReviewerEvaluationSchema } from "./calibration.js";

// ==============================================================================
// Evidence Citation Contract
// ==============================================================================

export const EvidenceCitationTypeSchema = z.enum([
  "code_diff",
  "test_assertion",
  "ai_prompt_query",
  "telemetry_metric",
]);
export type EvidenceCitationType = z.infer<typeof EvidenceCitationTypeSchema>;

export const EvidenceCitationSchema = z.object({
  id: z.string(),
  type: EvidenceCitationTypeSchema,
  dimensionId: RubricDimensionIdSchema,
  title: z.string(),
  citation: z.string(),
  significance: z.enum(["positive", "neutral", "concerning"]),
  timestamp: z.coerce.date().optional(),
});
export type EvidenceCitation = z.infer<typeof EvidenceCitationSchema>;

// ==============================================================================
// Dimension Report Breakdown
// ==============================================================================

export const DimensionReportBreakdownSchema = z.object({
  dimensionId: RubricDimensionIdSchema,
  name: z.string(),
  weight: z.number(),
  calibratedRating: RubricRatingAnchorSchema,
  calibratedLabel: z.enum(["Developing", "Competent", "Advanced", "Exemplary"]),
  weightedScoreContribution: z.number(),
  consensusRationale: z.string(),
  evidenceCitations: z.array(EvidenceCitationSchema),
});
export type DimensionReportBreakdown = z.infer<typeof DimensionReportBreakdownSchema>;

// ==============================================================================
// Reviewer Committee Sign-off Summary
// ==============================================================================

export const CommitteeSignoffSchema = z.object({
  reviewerId: z.string(),
  reviewerName: z.string(),
  reviewerEmail: z.string().email(),
  recommendation: HiringRecommendationSchema,
  weightedScore: z.number(),
  submittedAt: z.coerce.date(),
});
export type CommitteeSignoff = z.infer<typeof CommitteeSignoffSchema>;

// ==============================================================================
// Cryptographic Tamper-Evident Verification Seal
// ==============================================================================

export const TamperVerificationSealSchema = z.object({
  submissionFingerprint: z.string(), // Canonical SHA-256 of candidate submission artifact
  templateContentHash: z.string(),   // Canonical SHA-256 of immutable challenge template version
  reportSignature: z.string(),       // Canonical HMAC-SHA256 signature of report contents
  tamperCheckStatus: z.enum(["verified", "compromised", "unverified"]),
  sealedAt: z.coerce.date(),
});
export type TamperVerificationSeal = z.infer<typeof TamperVerificationSealSchema>;

// ==============================================================================
// Complete Evidence-Linked Hiring Decision Report
// ==============================================================================

export const HiringDecisionReportSchema = z.object({
  reportId: z.string(),
  sessionId: z.string(),
  organizationId: z.string(),
  organizationName: z.string(),
  candidateName: z.string(),
  candidateEmail: z.string().email(),
  templateId: z.string(),
  templateTitle: z.string(),
  targetRole: z.string(),
  difficulty: z.enum(["junior", "mid", "senior", "staff"]),
  
  // High-Level Outcome
  consensusRecommendation: z.enum([
    "strong_hire",
    "hire",
    "lean_hire",
    "no_hire",
    "pending_calibration",
  ]),
  calibrationStatus: z.enum(["calibrated", "requires_calibration", "pending_reviews"]),
  calibratedCompositeScore: z.number().min(0).max(100),
  executiveSummary: z.string(),
  
  // Committee Signoffs & Calibration Variance
  committeeSignoffs: z.array(CommitteeSignoffSchema),
  hasRecommendationConflict: z.boolean(),
  varianceAlerts: z.array(z.string()),

  // Dimension Scorecards & Citations
  dimensions: z.array(DimensionReportBreakdownSchema).length(7),

  // Execution & Telemetry Summary
  telemetrySummary: z.object({
    totalDurationSeconds: z.number(),
    totalPausedMs: z.number(),
    aiBudgetCapUsd: z.number(),
    aiBudgetConsumedUsd: z.number(),
    aiQueriesCount: z.number(),
    patchDecisions: z.object({
      accepted: z.number().int(),
      rejected: z.number().int(),
    }),
    attentionMetrics: z.object({
      blurCount: z.number().int(),
      pasteCount: z.number().int(),
    }),
    testsSummary: z.object({
      success: z.boolean(),
      passed: z.boolean(),
      passedCount: z.number().int(),
      totalCount: z.number().int(),
      durationMs: z.number(),
    }),
    technicalIncidentsCount: z.number().int(),
  }),

  // Tamper-Evident Seal
  verificationSeal: TamperVerificationSealSchema,

  generatedAt: z.coerce.date(),
});
export type HiringDecisionReport = z.infer<typeof HiringDecisionReportSchema>;

