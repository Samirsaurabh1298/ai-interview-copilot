import { and, eq, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { getDb, type AppDatabase } from "../db/connection.js";
import { assessmentSessions, sessionAutosaveMutations } from "../db/schema.js";
import {
  type AssessmentSession,
  type WorkspaceSnapshot,
  type SingleTestResult,
  SessionState,
  normalizeSessionState,
} from "@ai-copilot/contracts";
import {
  SessionNotFoundError,
  SessionExpiredError,
  SessionLockedError,
  SessionStaleRevisionError,
  SessionInvalidStateError,
  MutationIdConflictError,
} from "../services/session-errors.js";

export function computeCanonicalRequestHash(req: {
  code: string;
  testResults?: Array<{ name: string; passed: boolean; error?: string | null | undefined }>;
}): string {
  const normalizedTestResults = req.testResults && req.testResults.length > 0
    ? req.testResults.map((t) => ({
        error: t.error ?? null,
        name: t.name,
        passed: Boolean(t.passed),
      }))
    : null;

  const canonicalPayload = {
    code: req.code,
    testResults: normalizedTestResults,
  };

  return crypto.createHash("sha256").update(JSON.stringify(canonicalPayload)).digest("hex");
}

export interface SaveAutosaveMutationParams {
  sessionId: string;
  clientMutationId: string;
  baseRevision: number;
  code: string;
  testResults?: SingleTestResult[] | undefined;
}

export interface SaveAutosaveMutationResult {
  idempotent: boolean;
  session: AssessmentSession;
  serverRevision: number;
  snapshot: WorkspaceSnapshot;
}

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
      status: normalizeSessionState(session.status),
      stateVersion: session.stateVersion ?? 1,
      finalizingAt: session.finalizingAt ?? null,
      finalizingBy: session.finalizingBy ?? null,
      lastPersistedRevision: session.lastPersistedRevision ?? 0,
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

    if (patch.status !== undefined) updateValues.status = normalizeSessionState(patch.status);
    if (patch.stateVersion !== undefined) updateValues.stateVersion = patch.stateVersion;
    if (patch.finalizingAt !== undefined) updateValues.finalizingAt = patch.finalizingAt;
    if (patch.finalizingBy !== undefined) updateValues.finalizingBy = patch.finalizingBy;
    if (patch.lastPersistedRevision !== undefined)
      updateValues.lastPersistedRevision = patch.lastPersistedRevision;
    if (patch.submittedAt !== undefined) updateValues.submittedAt = patch.submittedAt;
    if (patch.expiresAt !== undefined) updateValues.expiresAt = patch.expiresAt;
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
    snapshot: WorkspaceSnapshot,
    allowedStatuses: string[] = ["ACTIVE", "in_progress"],
    opts?: { expectedBaseRevision?: number }
  ): Promise<AssessmentSession | null> {
    const db = await this.dbProvider();
    const normalizedStatuses = allowedStatuses.map((s) => normalizeSessionState(s));
    const statusConditions = normalizedStatuses.map((s) => sql`${assessmentSessions.status} = ${s}`);
    const statusMatchSql = sql`(${sql.join(statusConditions, sql` OR `)})`;

    const conditions = [
      sql`${assessmentSessions.id} = ${id}`,
      statusMatchSql,
      sql`clock_timestamp() <= ${assessmentSessions.expiresAt}`,
    ];

    if (opts?.expectedBaseRevision !== undefined) {
      conditions.push(sql`${assessmentSessions.lastPersistedRevision} = ${opts.expectedBaseRevision}`);
    }

    const rows = await db
      .update(assessmentSessions)
      .set({
        workspaceSnapshot: snapshot,
        lastPersistedRevision: sql`last_persisted_revision + 1`,
        updatedAt: new Date(),
      })
      .where(sql.join(conditions, sql` AND `))
      .returning();

    if (rows.length === 0 || !rows[0]) return null;
    return this.mapSession(rows[0]);
  }

  public async findMutation(
    sessionId: string,
    clientMutationId: string
  ): Promise<typeof sessionAutosaveMutations.$inferSelect | null> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(sessionAutosaveMutations)
      .where(
        and(
          eq(sessionAutosaveMutations.sessionId, sessionId),
          eq(sessionAutosaveMutations.clientMutationId, clientMutationId)
        )
      )
      .limit(1);
    return rows[0] || null;
  }

  public async listMutations(
    sessionId: string
  ): Promise<(typeof sessionAutosaveMutations.$inferSelect)[]> {
    const db = await this.dbProvider();
    return await db
      .select()
      .from(sessionAutosaveMutations)
      .where(eq(sessionAutosaveMutations.sessionId, sessionId));
  }

  /**
   * LOOP 10.0.4.2.4 — Durable Autosave Idempotency & Revision CAS.
   * Transactionally checks and executes CAS update on assessment_sessions
   * and persists immutable mutation record with unique database constraint.
   */
  public async saveAutosaveMutationTransactional(
    params: SaveAutosaveMutationParams
  ): Promise<SaveAutosaveMutationResult> {
    const db = await this.dbProvider();
    const requestHash = computeCanonicalRequestHash({
      code: params.code,
      ...(params.testResults !== undefined ? { testResults: params.testResults } : {}),
    });

    // 1. Fast idempotency check before transaction
    const existingFast = await this.findMutation(params.sessionId, params.clientMutationId);
    if (existingFast) {
      if (existingFast.requestHash === requestHash) {
        const session = await this.findById(params.sessionId);
        if (!session) throw new SessionNotFoundError(`Assessment session ${params.sessionId} not found`);
        return {
          idempotent: true,
          session,
          serverRevision: existingFast.serverRevision,
          snapshot: existingFast.committedSnapshot as WorkspaceSnapshot,
        };
      } else {
        throw new MutationIdConflictError(
          `Mutation ID '${params.clientMutationId}' was already committed with different content`
        );
      }
    }

    try {
      return await db.transaction(async (tx) => {
        // Double-check inside transaction in case another request inserted it concurrently
        const [existingInTx] = await tx
          .select()
          .from(sessionAutosaveMutations)
          .where(
            and(
              eq(sessionAutosaveMutations.sessionId, params.sessionId),
              eq(sessionAutosaveMutations.clientMutationId, params.clientMutationId)
            )
          )
          .limit(1);

        if (existingInTx) {
          if (existingInTx.requestHash === requestHash) {
            const [sessionRow] = await tx
              .select()
              .from(assessmentSessions)
              .where(eq(assessmentSessions.id, params.sessionId))
              .limit(1);
            if (!sessionRow) throw new SessionNotFoundError(`Assessment session ${params.sessionId} not found`);
            return {
              idempotent: true,
              session: this.mapSession(sessionRow),
              serverRevision: existingInTx.serverRevision,
              snapshot: existingInTx.committedSnapshot as WorkspaceSnapshot,
            };
          } else {
            throw new MutationIdConflictError(
              `Mutation ID '${params.clientMutationId}' was already committed with different content`
            );
          }
        }

        // Fetch current session in tx
        const [current] = await tx
          .select()
          .from(assessmentSessions)
          .where(eq(assessmentSessions.id, params.sessionId))
          .limit(1);

        if (!current) {
          throw new SessionNotFoundError(`Assessment session ${params.sessionId} not found`);
        }

        const normStatus = normalizeSessionState(current.status);
        if (normStatus === SessionState.GRACE_PERIOD) {
          throw new SessionExpiredError("Assessment duration has elapsed. Workspace modifications are locked during grace period.");
        }
        if (normStatus === SessionState.FINALIZING) {
          throw new SessionLockedError("Workspace is locked: assessment finalization is currently in progress.");
        }
        if (normStatus === SessionState.SUBMITTED) {
          throw new SessionLockedError("Workspace is permanently sealed: assessment has already been submitted.");
        }
        if (normStatus !== SessionState.ACTIVE) {
          throw new SessionInvalidStateError(`Cannot modify workspace: session status in database is '${current.status}'`);
        }

        // Stale base revision check before CAS
        if (current.lastPersistedRevision !== params.baseRevision) {
          throw new SessionStaleRevisionError(
            `Stale workspace revision rejected: incoming base revision (${params.baseRevision}) does not match currently persisted revision (${current.lastPersistedRevision})`
          );
        }

        const now = new Date();
        const newServerRevision = current.lastPersistedRevision + 1;
        const currentSnapshot = current.workspaceSnapshot as WorkspaceSnapshot;

        const newSnapshot: WorkspaceSnapshot = {
          ...currentSnapshot,
          currentCode: params.code,
          lastSavedAt: now,
          revision: newServerRevision,
          clientMutationId: params.clientMutationId,
          lastTestTotalCount: params.testResults ? params.testResults.length : currentSnapshot.lastTestTotalCount,
          lastTestPassedCount: params.testResults ? params.testResults.filter((t) => t.passed).length : currentSnapshot.lastTestPassedCount,
        };

        // CAS update on assessment_sessions
        const updatedRows = await tx
          .update(assessmentSessions)
          .set({
            workspaceSnapshot: newSnapshot,
            lastPersistedRevision: sql`last_persisted_revision + 1`,
            updatedAt: now,
          })
          .where(
            and(
              eq(assessmentSessions.id, params.sessionId),
              sql`(${assessmentSessions.status} = 'ACTIVE' OR ${assessmentSessions.status} = 'in_progress')`,
              sql`clock_timestamp() <= ${assessmentSessions.expiresAt}`,
              eq(assessmentSessions.lastPersistedRevision, params.baseRevision)
            )
          )
          .returning();

        if (updatedRows.length === 0 || !updatedRows[0]) {
          const [checkRow] = await tx
            .select()
            .from(assessmentSessions)
            .where(eq(assessmentSessions.id, params.sessionId))
            .limit(1);

          if (!checkRow) throw new SessionNotFoundError(`Assessment session ${params.sessionId} not found`);
          const st = normalizeSessionState(checkRow.status);
          if (st === SessionState.GRACE_PERIOD) {
            throw new SessionExpiredError("Assessment duration has elapsed. Workspace modifications are locked during grace period.");
          }
          if (st === SessionState.FINALIZING) {
            throw new SessionLockedError("Workspace is locked: assessment finalization is currently in progress.");
          }
          if (st === SessionState.SUBMITTED) {
            throw new SessionLockedError("Workspace is permanently sealed: assessment has already been submitted.");
          }
          if (st !== SessionState.ACTIVE) {
            throw new SessionInvalidStateError(`Cannot modify workspace: session status in database is '${checkRow.status}'`);
          }
          if (checkRow.lastPersistedRevision !== params.baseRevision) {
            throw new SessionStaleRevisionError(
              `Stale workspace revision rejected: incoming base revision (${params.baseRevision}) does not match currently persisted revision (${checkRow.lastPersistedRevision})`
            );
          }
          throw new SessionExpiredError("Assessment duration has elapsed. Workspace modifications are locked.");
        }

        const updatedSession = this.mapSession(updatedRows[0]);

        // Insert durable mutation record
        const mutationRecordId = `mut_${crypto.randomUUID()}`;
        await tx.insert(sessionAutosaveMutations).values({
          id: mutationRecordId,
          sessionId: params.sessionId,
          clientMutationId: params.clientMutationId,
          baseRevision: params.baseRevision,
          serverRevision: newServerRevision,
          requestHash,
          committedSnapshot: newSnapshot,
          createdAt: now,
        });

        return {
          idempotent: false,
          session: updatedSession,
          serverRevision: newServerRevision,
          snapshot: newSnapshot,
        };
      });
    } catch (err: unknown) {
      // Concurrent duplicate request recovery
      const existingAfterCatch = await this.findMutation(params.sessionId, params.clientMutationId);
      if (existingAfterCatch) {
        if (existingAfterCatch.requestHash === requestHash) {
          const session = await this.findById(params.sessionId);
          if (session) {
            return {
              idempotent: true,
              session,
              serverRevision: existingAfterCatch.serverRevision,
              snapshot: existingAfterCatch.committedSnapshot as WorkspaceSnapshot,
            };
          }
        } else {
          throw new MutationIdConflictError(
            `Mutation ID '${params.clientMutationId}' was already committed with different content`
          );
        }
      }
      throw err;
    }
  }

  /**
   * Atomic conditional state transition with optimistic concurrency control (LOOP 10.0.4).
   * Ensures that two concurrent API instances cannot finalize the same session.
   */
  public async atomicTransitionState(
    id: string,
    allowedFromStates: string[],
    nextState: string,
    patch: Partial<AssessmentSession> = {},
    expectedVersion?: number
  ): Promise<{ success: boolean; session?: AssessmentSession | undefined; conflictSession?: AssessmentSession | undefined }> {
    const db = await this.dbProvider();
    const normalizedNextState = normalizeSessionState(nextState);
    const normalizedFromStates = allowedFromStates.map((s) => normalizeSessionState(s));

    const updateValues: Record<string, unknown> = {
      status: normalizedNextState,
      stateVersion: sql`state_version + 1`,
      updatedAt: new Date(),
    };

    if (patch.submittedAt !== undefined) updateValues.submittedAt = patch.submittedAt;
    if (patch.expiresAt !== undefined) updateValues.expiresAt = patch.expiresAt;
    if (patch.pausedAt !== undefined) updateValues.pausedAt = patch.pausedAt;
    if (patch.totalPausedMs !== undefined) updateValues.totalPausedMs = patch.totalPausedMs;
    if (patch.pauseReason !== undefined) updateValues.pauseReason = patch.pauseReason;
    if (patch.finalizingAt !== undefined) updateValues.finalizingAt = patch.finalizingAt;
    if (patch.finalizingBy !== undefined) updateValues.finalizingBy = patch.finalizingBy;
    if (patch.terminationReason !== undefined) updateValues.terminationReason = patch.terminationReason;
    if (patch.workspaceSnapshot !== undefined) updateValues.workspaceSnapshot = patch.workspaceSnapshot;

    const fromConditions = normalizedFromStates.map((s) => sql`${assessmentSessions.status} = ${s}`);
    const stateMatchSql = sql`(${sql.join(fromConditions, sql` OR `)})`;

    const conditions = [
      eq(assessmentSessions.id, id),
      stateMatchSql,
    ];

    if (expectedVersion !== undefined) {
      conditions.push(eq(assessmentSessions.stateVersion, expectedVersion));
    }

    const rows = await db
      .update(assessmentSessions)
      .set(updateValues)
      .where(sql.join(conditions, sql` AND `))
      .returning();

    if (rows.length === 0 || !rows[0]) {
      const current = await this.findById(id);
      return { success: false, conflictSession: current ?? undefined };
    }

    return { success: true, session: this.mapSession(rows[0]) };
  }

  /**
   * Discovers sessions stuck in 'FINALIZING' state (e.g. following an API crash or timeout).
   */
  public async findStuckFinalizing(timeoutMs = 30000): Promise<AssessmentSession[]> {
    const db = await this.dbProvider();
    const cutoff = new Date(Date.now() - timeoutMs);
    const rows = await db
      .select()
      .from(assessmentSessions)
      .where(
        sql`${assessmentSessions.status} = 'FINALIZING' AND ${assessmentSessions.finalizingAt} <= ${cutoff}`
      );
    return rows.map((r) => this.mapSession(r));
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
      .returning();
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
      stateVersion: row.stateVersion ?? 1,
      finalizingAt: row.finalizingAt ? new Date(row.finalizingAt) : undefined,
      finalizingBy: row.finalizingBy ?? undefined,
      lastPersistedRevision: row.lastPersistedRevision ?? 0,
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
