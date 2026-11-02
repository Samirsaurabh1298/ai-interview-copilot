import crypto from "node:crypto";
import type {
  ReviewerEvaluation,
  SubmitReviewerEvaluationRequest,
  CalibrationConsensus,
  DimensionCalibration,
  HiringRecommendation,
  RubricDimensionId,
  AuthUserContext,
  AssessmentScorecard,
  SubmissionArtifact,
} from "@ai-copilot/contracts";
import { AssessmentEvaluator } from "@ai-copilot/scoring-engine";
import type { AssessmentSessionService } from "./session.js";
import type { SubmissionService } from "./submission.js";
import type { SessionEventsService } from "./session-events.js";
import type { OrganizationService } from "./organization.js";

export const RUBRIC_DIMENSION_WEIGHTS: Record<RubricDimensionId, { name: string; weight: number }> = {
  "code-comprehension": { name: "Code Comprehension & Localization", weight: 20 },
  "problem-framing": { name: "Problem Framing & Architecture Strategy", weight: 10 },
  "ai-collaboration": { name: "AI Collaboration & Prompt Formulation", weight: 15 },
  "critical-evaluation": { name: "Critical Evaluation of AI Suggestions", weight: 15 },
  "debugging-implementation": { name: "Debugging & Solution Implementation", weight: 20 },
  "testing-verification": { name: "Testing & Verification Discipline", weight: 10 },
  "explanation-judgment": { name: "Technical Explanation & Engineering Judgment", weight: 10 },
};

export class CalibrationService {
  private evaluations = new Map<string, ReviewerEvaluation>(); // key: id
  private sessionIndex = new Map<string, Set<string>>(); // key: sessionId -> Set of evalIds
  private aiEvaluator = new AssessmentEvaluator();

  constructor(
    private sessionService: AssessmentSessionService,
    private submissionService: SubmissionService,
    private sessionEventService: SessionEventsService,
    private orgService?: OrganizationService
  ) {}

  public calculateWeightedTotalScore(scores: { dimensionId: RubricDimensionId; rating: number }[]): number {
    let totalScore = 0;
    for (const s of scores) {
      const dimInfo = RUBRIC_DIMENSION_WEIGHTS[s.dimensionId];
      if (dimInfo) {
        // rating is 1..4. Contribution = (rating / 4) * weight
        const contribution = (s.rating / 4) * dimInfo.weight;
        totalScore += contribution;
      }
    }
    return Math.round(totalScore * 10) / 10;
  }

  public async submitEvaluation(
    sessionId: string,
    reviewer: AuthUserContext,
    req: SubmitReviewerEvaluationRequest
  ): Promise<ReviewerEvaluation> {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`Assessment session not found: ${sessionId}`);
    }

    if (session.organizationId !== reviewer.organizationId) {
      throw new Error("Unauthorized: Session belongs to a different organization");
    }

    const existingEvalId = this.findEvaluationId(sessionId, reviewer.userId);
    const weightedTotalScore = this.calculateWeightedTotalScore(req.scores);
    const now = new Date();

    let reviewerName = reviewer.email?.split("@")[0] || reviewer.userId;
    if (this.orgService && reviewer.organizationId && reviewer.email) {
      try {
        const members = this.orgService.listMembers(reviewer.organizationId);
        const found = members.find((m) => m.email.toLowerCase() === reviewer.email?.toLowerCase());
        if (found) {
          reviewerName = found.name;
        }
      } catch {
        // Fallback
      }
    }

    if (existingEvalId && this.evaluations.has(existingEvalId)) {
      const existing = this.evaluations.get(existingEvalId)!;
      const updated: ReviewerEvaluation = {
        ...existing,
        reviewerName,
        scores: req.scores,
        weightedTotalScore,
        recommendation: req.recommendation,
        summaryRationale: req.summaryRationale,
        updatedAt: now,
      };
      this.evaluations.set(existingEvalId, updated);
      return updated;
    }

    const evalId = "eval_" + crypto.randomBytes(8).toString("hex") + "_" + Date.now();
    const newEval: ReviewerEvaluation = {
      id: evalId,
      sessionId,
      organizationId: session.organizationId,
      reviewerId: reviewer.userId,
      reviewerName,
      reviewerEmail: reviewer.email || `${reviewer.userId}@org.test`,
      scores: req.scores,
      weightedTotalScore,
      recommendation: req.recommendation,
      summaryRationale: req.summaryRationale,
      createdAt: now,
      updatedAt: now,
    };

    this.evaluations.set(evalId, newEval);
    if (!this.sessionIndex.has(sessionId)) {
      this.sessionIndex.set(sessionId, new Set());
    }
    this.sessionIndex.get(sessionId)!.add(evalId);

    return newEval;
  }

  public async getEvaluations(
    sessionId: string,
    requestingUser?: AuthUserContext
  ): Promise<{ evaluations: ReviewerEvaluation[]; isMasked: boolean }> {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`Assessment session not found: ${sessionId}`);
    }

    const evalIds = this.sessionIndex.get(sessionId);
    if (!evalIds || evalIds.size === 0) {
      return { evaluations: [], isMasked: false };
    }

    const allEvals = Array.from(evalIds)
      .map((id) => this.evaluations.get(id))
      .filter((e): e is ReviewerEvaluation => Boolean(e));

    // Blind Calibration Rule:
    // If requesting user is owner or admin, they see all evaluations unmasked.
    // If requesting user is interviewer or reviewer:
    // They can only see other reviews after they have submitted their own review.
    if (requestingUser) {
      const isElevated = requestingUser.role === "owner" || requestingUser.role === "admin";
      if (!isElevated) {
        const userHasSubmitted = allEvals.some((e) => e.reviewerId === requestingUser.userId);
        if (!userHasSubmitted) {
          // Return only a note or mask other evaluations
          return { evaluations: [], isMasked: true };
        }
      }
    }

    return { evaluations: allEvals, isMasked: false };
  }

  public async getCalibrationConsensus(
    sessionId: string,
    requestingUser?: AuthUserContext
  ): Promise<CalibrationConsensus> {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`Assessment session not found: ${sessionId}`);
    }

    const { evaluations } = await this.getEvaluations(sessionId, requestingUser);

    const dimensions: DimensionCalibration[] = [];
    const recommendations: Record<string, { reviewerName: string; recommendation: HiringRecommendation }> = {};
    const discussionTopics: string[] = [];

    for (const ev of evaluations) {
      recommendations[ev.reviewerId] = {
        reviewerName: ev.reviewerName,
        recommendation: ev.recommendation,
      };
    }

    let hasHighVariance = false;
    let hasRecommendationConflict = false;

    // Check dimension calibrations
    const dimensionKeys = Object.keys(RUBRIC_DIMENSION_WEIGHTS) as RubricDimensionId[];
    for (const dimId of dimensionKeys) {
      const dimMeta = RUBRIC_DIMENSION_WEIGHTS[dimId];
      const ratingsByReviewer: Record<
        string,
        { reviewerName: string; rating: 1 | 2 | 3 | 4; rationale: string }
      > = {};

      let minRating = 4;
      let maxRating = 1;

      for (const ev of evaluations) {
        const scoreEntry = ev.scores.find((s) => s.dimensionId === dimId);
        if (scoreEntry) {
          ratingsByReviewer[ev.reviewerId] = {
            reviewerName: ev.reviewerName,
            rating: scoreEntry.rating as 1 | 2 | 3 | 4,
            rationale: scoreEntry.rationale,
          };
          if (scoreEntry.rating < minRating) minRating = scoreEntry.rating;
          if (scoreEntry.rating > maxRating) maxRating = scoreEntry.rating;
        }
      }

      const variance = evaluations.length > 1 ? maxRating - minRating : 0;
      let alignment: "aligned" | "moderate" | "high_variance" = "aligned";
      let requiresDiscussion = false;

      if (variance >= 2) {
        alignment = "high_variance";
        requiresDiscussion = true;
        hasHighVariance = true;
        discussionTopics.push(
          `Reviewer divergence on "${dimMeta.name}" (Anchor spread: ${minRating} to ${maxRating}). Requires calibration.`
        );
      } else if (variance === 1) {
        alignment = "moderate";
      }

      dimensions.push({
        dimensionId: dimId,
        name: dimMeta.name,
        weight: dimMeta.weight,
        ratingsByReviewer,
        minRating: evaluations.length > 0 ? minRating : 1,
        maxRating: evaluations.length > 0 ? maxRating : 1,
        variance,
        alignment,
        requiresDiscussion,
      });
    }

    // Recommendation Conflict Check
    const recValues = Object.values(recommendations).map((r) => r.recommendation);
    const hasPositive = recValues.some((r) => r === "strong_hire" || r === "hire");
    const hasNegative = recValues.some((r) => r === "no_hire");
    if (hasPositive && hasNegative) {
      hasRecommendationConflict = true;
      discussionTopics.push(
        "Conflicting hiring recommendations detected (Positive Hire vs No Hire). Formal calibration committee review required."
      );
    }

    // Compute Consensus Recommendation
    let consensusRecommendation: HiringRecommendation | null = null;
    if (evaluations.length >= 2 && !hasRecommendationConflict) {
      if (recValues.every((r) => r === "strong_hire")) consensusRecommendation = "strong_hire";
      else if (recValues.every((r) => r === "hire" || r === "strong_hire")) consensusRecommendation = "hire";
      else if (recValues.every((r) => r === "no_hire")) consensusRecommendation = "no_hire";
      else consensusRecommendation = "lean_hire";
    }

    const requiresDiscussion = hasHighVariance || hasRecommendationConflict;
    let status: "pending_reviews" | "requires_calibration" | "calibrated" = "pending_reviews";
    if (evaluations.length >= 2) {
      status = requiresDiscussion ? "requires_calibration" : "calibrated";
    }

    return {
      sessionId,
      organizationId: session.organizationId,
      status,
      evaluationsCount: evaluations.length,
      evaluations,
      dimensions,
      recommendations,
      consensusRecommendation,
      hasRecommendationConflict,
      requiresDiscussion,
      discussionTopics,
      calculatedAt: new Date(),
    };
  }

  public async generateAiDraftScorecard(sessionId: string): Promise<AssessmentScorecard> {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`Assessment session not found: ${sessionId}`);
    }

    let artifact: SubmissionArtifact | null = null;
    try {
      artifact = this.submissionService.getSubmission(sessionId);
    } catch {
      // Artifact not submitted yet, fallback to session workspace snapshot
    }

    const telemetryEvents = this.sessionEventService.getEvents(sessionId);

    const prompts = telemetryEvents
      .filter((e) => e.type === "ai_query" && Boolean(e.payload?.question))
      .map((e) => String(e.payload!.question));

    const testResults = (artifact?.testExecutionLog.tests ?? []).map((t) => ({
      name: t.name,
      passed: t.passed,
      durationMs: t.durationMs,
      error: t.error,
    }));

    return this.aiEvaluator.evaluateSubmission(
      {
        sessionId,
        candidateId: session.candidateEmail,
        finalCode: artifact?.finalCode ?? session.workspaceSnapshot.currentCode,
        diff: artifact?.codeDiff.unifiedDiff ?? "",
        explanation: artifact?.technicalExplanation ?? "Candidate workspace in progress.",
        testResults,
        submittedAt: artifact?.submittedAt ?? new Date(),
      },
      {
        aiPromptCount: telemetryEvents.filter((e) => e.type === "ai_query").length,
        totalCostUsd: session.consumedAiBudgetUsd,
        prompts,
      }
    );
  }

  private findEvaluationId(sessionId: string, reviewerId: string): string | null {
    const evalIds = this.sessionIndex.get(sessionId);
    if (!evalIds) return null;
    for (const id of evalIds) {
      const ev = this.evaluations.get(id);
      if (ev && ev.reviewerId === reviewerId) {
        return id;
      }
    }
    return null;
  }
}
