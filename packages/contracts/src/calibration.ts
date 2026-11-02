import { z } from "zod";
import { RubricDimensionIdSchema, RubricRatingAnchorSchema } from "./assessment.js";

// ==============================================================================
// Hiring Recommendation Anchor
// ==============================================================================

export const HiringRecommendationSchema = z.enum([
  "strong_hire",
  "hire",
  "lean_hire",
  "no_hire",
]);
export type HiringRecommendation = z.infer<typeof HiringRecommendationSchema>;

// ==============================================================================
// Individual Reviewer Rubric Dimension Score
// ==============================================================================

export const ReviewerDimensionScoreSchema = z.object({
  dimensionId: RubricDimensionIdSchema,
  name: z.string(),
  rating: RubricRatingAnchorSchema,
  rationale: z.string().min(5, "A substantive rationale of at least 5 characters is required"),
  evidenceCitations: z.array(z.string()).default([]),
});
export type ReviewerDimensionScore = z.infer<typeof ReviewerDimensionScoreSchema>;

// ==============================================================================
// Reviewer Evaluation Record
// ==============================================================================

export const ReviewerEvaluationSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  organizationId: z.string(),
  reviewerId: z.string(),
  reviewerName: z.string(),
  reviewerEmail: z.string().email(),
  scores: z.array(ReviewerDimensionScoreSchema).length(7, "All 7 rubric dimensions must be scored"),
  weightedTotalScore: z.number().min(0).max(100),
  recommendation: HiringRecommendationSchema,
  summaryRationale: z.string().min(10, "Summary rationale must be at least 10 characters"),
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
});
export type ReviewerEvaluation = z.infer<typeof ReviewerEvaluationSchema>;

export const SubmitReviewerEvaluationRequestSchema = z.object({
  scores: z.array(ReviewerDimensionScoreSchema).length(7, "All 7 rubric dimensions must be scored"),
  recommendation: HiringRecommendationSchema,
  summaryRationale: z.string().min(10, "Summary rationale must be at least 10 characters"),
});
export type SubmitReviewerEvaluationRequest = z.infer<typeof SubmitReviewerEvaluationRequestSchema>;

// ==============================================================================
// Calibration Consensus & Variance Analysis
// ==============================================================================

export const DimensionCalibrationSchema = z.object({
  dimensionId: RubricDimensionIdSchema,
  name: z.string(),
  weight: z.number(),
  ratingsByReviewer: z.record(z.string(), z.object({
    reviewerName: z.string(),
    rating: RubricRatingAnchorSchema,
    rationale: z.string(),
  })),
  minRating: z.number().min(1).max(4),
  maxRating: z.number().min(1).max(4),
  variance: z.number().min(0).max(3),
  alignment: z.enum(["aligned", "moderate", "high_variance"]),
  requiresDiscussion: z.boolean(),
});
export type DimensionCalibration = z.infer<typeof DimensionCalibrationSchema>;

export const CalibrationConsensusSchema = z.object({
  sessionId: z.string(),
  organizationId: z.string(),
  status: z.enum(["pending_reviews", "requires_calibration", "calibrated"]),
  evaluationsCount: z.number().int().min(0),
  evaluations: z.array(ReviewerEvaluationSchema),
  dimensions: z.array(DimensionCalibrationSchema),
  recommendations: z.record(z.string(), z.object({
    reviewerName: z.string(),
    recommendation: HiringRecommendationSchema,
  })),
  consensusRecommendation: HiringRecommendationSchema.nullable(),
  hasRecommendationConflict: z.boolean(),
  requiresDiscussion: z.boolean(),
  discussionTopics: z.array(z.string()),
  calculatedAt: z.coerce.date().default(() => new Date()),
});
export type CalibrationConsensus = z.infer<typeof CalibrationConsensusSchema>;
