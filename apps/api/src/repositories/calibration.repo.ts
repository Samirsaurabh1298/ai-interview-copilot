import { eq } from "drizzle-orm";
import { getDb, type AppDatabase } from "../db/connection.js";
import { reviewerEvaluations } from "../db/schema.js";
import type { ReviewerEvaluation } from "@ai-copilot/contracts";

export class CalibrationRepository {
  constructor(private dbProvider: () => Promise<AppDatabase> = getDb) {}

  public async create(evaluation: ReviewerEvaluation): Promise<ReviewerEvaluation> {
    const db = await this.dbProvider();
    await db.insert(reviewerEvaluations).values({
      id: evaluation.id,
      sessionId: evaluation.sessionId,
      organizationId: evaluation.organizationId,
      reviewerId: evaluation.reviewerId,
      reviewerName: evaluation.reviewerName,
      reviewerEmail: evaluation.reviewerEmail,
      scores: evaluation.scores,
      weightedTotalScore: evaluation.weightedTotalScore.toFixed(2),
      recommendation: evaluation.recommendation,
      summaryRationale: evaluation.summaryRationale,
      createdAt: evaluation.createdAt,
      updatedAt: evaluation.updatedAt,
    });
    return evaluation;
  }

  public async listBySession(sessionId: string): Promise<ReviewerEvaluation[]> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(reviewerEvaluations)
      .where(eq(reviewerEvaluations.sessionId, sessionId));
    return rows.map((r) => this.mapEvaluation(r));
  }

  private mapEvaluation(row: typeof reviewerEvaluations.$inferSelect): ReviewerEvaluation {
    return {
      id: row.id,
      sessionId: row.sessionId,
      organizationId: row.organizationId,
      reviewerId: row.reviewerId,
      reviewerName: row.reviewerName,
      reviewerEmail: row.reviewerEmail,
      scores: row.scores as ReviewerEvaluation["scores"],
      weightedTotalScore: Number(row.weightedTotalScore),
      recommendation: row.recommendation as ReviewerEvaluation["recommendation"],
      summaryRationale: row.summaryRationale,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}

