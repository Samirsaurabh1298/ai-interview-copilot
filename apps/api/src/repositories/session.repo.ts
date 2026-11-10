import { eq, sql } from "drizzle-orm";
import { getDb, type AppDatabase } from "../db/connection.js";
import { assessmentSessions } from "../db/schema.js";
import type { AssessmentSession, WorkspaceSnapshot } from "@ai-copilot/contracts";

export class SessionRepository {
  constructor(private dbProvider: () => Promise<AppDatabase> = getDb) {}

  public async create(session: AssessmentSession): Promise<AssessmentSession> {
    const db = await this.dbProvider();
    await db.insert(assessmentSessions).values({
      id: session.id,
      organizationId: session.organizationId,
      templateId: session.templateId,
      versionId: session.versionId ?? null,
      invitationId: session.invitationId ?? null,
      candidateEmail: session.candidateEmail,
      candidateName: session.candidateName,
      status: session.status,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
      submittedAt: session.submittedAt ?? null,
      pausedAt: session.pausedAt ?? null,
      totalPausedMs: session.totalPausedMs,
      pauseReason: session.pauseReason ?? null,
      terminationReason: session.terminationReason ?? null,
      durationMinutes: session.durationMinutes,
      gracePeriodSeconds: session.gracePeriodSeconds,
      allocatedAiBudgetUsd: session.allocatedAiBudgetUsd.toFixed(4),
      consumedAiBudgetUsd: session.consumedAiBudgetUsd.toFixed(5),
      toolPolicy: session.toolPolicy,
      workspaceSnapshot: session.workspaceSnapshot,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
    return session;
  }

  public async findById(id: string): Promise<AssessmentSession | null> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(assessmentSessions)
      .where(eq(assessmentSessions.id, id))
      .limit(1);

    if (rows.length === 0 || !rows[0]) return null;
    return this.mapSession(rows[0]);
  }

  public async listByOrg(orgId: string): Promise<AssessmentSession[]> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(assessmentSessions)
      .where(eq(assessmentSessions.organizationId, orgId));
    return rows.map((r) => this.mapSession(r));
  }

  public async listAll(): Promise<AssessmentSession[]> {
    const db = await this.dbProvider();
    const rows = await db.select().from(assessmentSessions);
    return rows.map((r) => this.mapSession(r));
  }

  public async update(
    id: string,
    patch: Partial<AssessmentSession>
  ): Promise<AssessmentSession | null> {
    const db = await this.dbProvider();
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (patch.status !== undefined) updateValues.status = patch.status;
    if (patch.submittedAt !== undefined) updateValues.submittedAt = patch.submittedAt;
    if (patch.pausedAt !== undefined) updateValues.pausedAt = patch.pausedAt;
    if (patch.totalPausedMs !== undefined) updateValues.totalPausedMs = patch.totalPausedMs;
    if (patch.pauseReason !== undefined) updateValues.pauseReason = patch.pauseReason;
    if (patch.terminationReason !== undefined)
      updateValues.terminationReason = patch.terminationReason;
    if (patch.consumedAiBudgetUsd !== undefined)
      updateValues.consumedAiBudgetUsd = patch.consumedAiBudgetUsd.toFixed(5);
    if (patch.workspaceSnapshot !== undefined)
      updateValues.workspaceSnapshot = patch.workspaceSnapshot;

    const rows = await db
      .update(assessmentSessions)
      .set(updateValues)
      .where(eq(assessmentSessions.id, id))
      .returning();

    if (rows.length === 0 || !rows[0]) return null;
    return this.mapSession(rows[0]);
  }

  public async updateWorkspaceSnapshot(
    id: string,
    snapshot: WorkspaceSnapshot
  ): Promise<AssessmentSession | null> {
    const db = await this.dbProvider();
    const rows = await db
      .update(assessmentSessions)
      .set({
        workspaceSnapshot: snapshot,
        updatedAt: new Date(),
      })
      .where(eq(assessmentSessions.id, id))
      .returning();

    if (rows.length === 0 || !rows[0]) return null;
    return this.mapSession(rows[0]);
  }

  /**
   * Race-safe atomic token budget consumption.
   * Increments consumed budget only if new total does not exceed allocated budget.
   */
  public async atomicRecordAiUsage(
    sessionId: string,
    costUsd: number,
    maxBudgetUsd: number
  ): Promise<{ success: boolean; newConsumedUsd: number; remainingUsd: number }> {
    const db = await this.dbProvider();
    const rows = await db
      .update(assessmentSessions)
      .set({
        consumedAiBudgetUsd: sql`consumed_ai_budget_usd + ${costUsd.toFixed(5)}::numeric`,
        updatedAt: new Date(),
      })
      .where(
        sql`${assessmentSessions.id} = ${sessionId} AND (consumed_ai_budget_usd + ${costUsd.toFixed(5)}::numeric) <= ${maxBudgetUsd.toFixed(4)}::numeric`
      )
      .returning();

    if (rows.length === 0 || !rows[0]) {
      // Query current state
      const current = await this.findById(sessionId);
      const consumed = current?.consumedAiBudgetUsd ?? 0;
      return {
        success: false,
        newConsumedUsd: consumed,
        remainingUsd: Math.max(0, maxBudgetUsd - consumed),
      };
    }

    const newConsumed = Number(rows[0].consumedAiBudgetUsd);
    return {
      success: true,
      newConsumedUsd: newConsumed,
      remainingUsd: Math.max(0, Number(rows[0].allocatedAiBudgetUsd) - newConsumed),
    };
  }

  public async delete(id: string): Promise<boolean> {
    const db = await this.dbProvider();
    const rows = await db
      .delete(assessmentSessions)
      .where(eq(assessmentSessions.id, id))
      .returning({ id: assessmentSessions.id });
    return rows.length > 0;
  }

  private mapSession(row: typeof assessmentSessions.$inferSelect): AssessmentSession {
    return {
      id: row.id,
      organizationId: row.organizationId,
      templateId: row.templateId,
      versionId: row.versionId ?? undefined,
      invitationId: row.invitationId ?? undefined,
      candidateEmail: row.candidateEmail,
      candidateName: row.candidateName,
      status: row.status as AssessmentSession["status"],
      startedAt: new Date(row.startedAt),
      expiresAt: new Date(row.expiresAt),
      submittedAt: row.submittedAt ? new Date(row.submittedAt) : undefined,
      pausedAt: row.pausedAt ? new Date(row.pausedAt) : undefined,
      totalPausedMs: row.totalPausedMs,
      pauseReason: row.pauseReason ?? undefined,
      terminationReason: row.terminationReason ?? undefined,
      durationMinutes: row.durationMinutes,
      gracePeriodSeconds: row.gracePeriodSeconds,
      allocatedAiBudgetUsd: Number(row.allocatedAiBudgetUsd),
      consumedAiBudgetUsd: Number(row.consumedAiBudgetUsd),
      toolPolicy: row.toolPolicy as AssessmentSession["toolPolicy"],
      workspaceSnapshot: row.workspaceSnapshot as AssessmentSession["workspaceSnapshot"],
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
