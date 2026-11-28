import { eq, sql } from "drizzle-orm";
import { getDb, type AppDatabase } from "../db/connection.js";
import { submissionArtifacts, assessmentSessions } from "../db/schema.js";
import type { SubmissionArtifact } from "@ai-copilot/contracts";

export class SubmissionRepository {
  constructor(private dbProvider: () => Promise<AppDatabase> = getDb) { }

  public async create(artifact: SubmissionArtifact): Promise<SubmissionArtifact> {
    const db = await this.dbProvider();
    try {
      await db.insert(submissionArtifacts).values({
        id: artifact.id,
        sessionId: artifact.sessionId,
        organizationId: artifact.organizationId,
        templateId: artifact.templateId,
        candidateName: artifact.candidateName,
        candidateEmail: artifact.candidateEmail,
        submittedAt: artifact.submittedAt,
        finalCode: artifact.finalCode,
        starterCode: artifact.starterCode,
        codeDiff: artifact.codeDiff,
        testExecutionLog: artifact.testExecutionLog,
        technicalExplanation: artifact.technicalExplanation,
        telemetrySummary: artifact.telemetrySummary,
        templateContentHash: artifact.templateContentHash,
        submissionFingerprint: artifact.submissionFingerprint,
        taskSubmissions: artifact.taskSubmissions || {},
        serverAcknowledgedRevision: artifact.serverAcknowledgedRevision ?? null,
        finalizedBy: artifact.finalizedBy ?? null,
        multiFileChanges: artifact.multiFileChanges ?? null,
        defenseResponses: artifact.defenseResponses ?? null,
      });
      return artifact;
    } catch (err: unknown) {
      // If unique constraint on sessionId violated, return existing persisted artifact (idempotent CAS)
      const existing = await this.findBySessionId(artifact.sessionId);
      if (existing) {
        return existing;
      }
      throw err;
    }
  }

  /**
   * Transactionally seals an immutable submission artifact and transitions the assessment session to SUBMITTED.
   * Guarantees that an artifact cannot exist without the session transitioning, and vice versa.
   * Strictly enforces FINALIZING -> SUBMITTED with OCC expectedVersion and lease ownership checks.
   */
  public async sealArtifactAndTransitionSession(
    artifact: SubmissionArtifact,
    sessionPatch: {
      submittedAt: Date;
      workspaceSnapshot: Record<string, unknown>;
    },
    expectedVersion?: number,
    finalizingBy?: string
  ): Promise<{ success: boolean; artifact: SubmissionArtifact; conflictState?: string }> {
    const db = await this.dbProvider();

    // Idempotency fast path: if artifact already exists, return it
    const existing = await this.findBySessionId(artifact.sessionId);
    if (existing) {
      return { success: true, artifact: existing };
    }

    try {
      return await db.transaction(async (tx) => {
        // 1. Insert immutable artifact
        await tx.insert(submissionArtifacts).values({
          id: artifact.id,
          sessionId: artifact.sessionId,
          organizationId: artifact.organizationId,
          templateId: artifact.templateId,
          candidateName: artifact.candidateName,
          candidateEmail: artifact.candidateEmail,
          submittedAt: artifact.submittedAt,
          finalCode: artifact.finalCode,
          starterCode: artifact.starterCode,
          codeDiff: artifact.codeDiff,
          testExecutionLog: artifact.testExecutionLog,
          technicalExplanation: artifact.technicalExplanation,
          telemetrySummary: artifact.telemetrySummary,
          templateContentHash: artifact.templateContentHash,
          submissionFingerprint: artifact.submissionFingerprint,
          taskSubmissions: artifact.taskSubmissions || {},
          serverAcknowledgedRevision: artifact.serverAcknowledgedRevision ?? null,
          finalizedBy: artifact.finalizedBy ?? null,
          multiFileChanges: artifact.multiFileChanges ?? null,
          defenseResponses: artifact.defenseResponses ?? null,
        });

        // 2. Strictly require status = 'FINALIZING' with OCC version and lease fencing
        const conditions = [
          eq(assessmentSessions.id, artifact.sessionId),
          eq(assessmentSessions.status, "FINALIZING"),
        ];
        if (expectedVersion !== undefined) {
          conditions.push(eq(assessmentSessions.stateVersion, expectedVersion));
        }
        if (finalizingBy !== undefined) {
          conditions.push(eq(assessmentSessions.finalizingBy, finalizingBy));
        }

        const updatedRows = await tx
          .update(assessmentSessions)
          .set({
            status: "SUBMITTED",
            stateVersion: sql`state_version + 1`,
            submittedAt: sessionPatch.submittedAt,
            workspaceSnapshot: sessionPatch.workspaceSnapshot,
            updatedAt: new Date(),
          })
          .where(sql.join(conditions, sql` AND `))
          .returning();

        if (updatedRows.length === 0) {
          throw new Error("LEASE_FENCING_CONFLICT");
        }

        return { success: true, artifact };
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "LEASE_FENCING_CONFLICT") {
        const existingAfterConflict = await this.findBySessionId(artifact.sessionId);
        if (existingAfterConflict) {
          return { success: true, artifact: existingAfterConflict };
        }
        // Retrieve current DB status for structured conflict diagnostics
        const currentRows = await db
          .select({ status: assessmentSessions.status })
          .from(assessmentSessions)
          .where(eq(assessmentSessions.id, artifact.sessionId))
          .limit(1);
        return {
          success: false,
          artifact,
          ...(currentRows[0]?.status ? { conflictState: currentRows[0].status } : {}),
        };
      }

      // Check for unique key constraint collision (another worker committed artifact concurrently)
      const existingAfterCatch = await this.findBySessionId(artifact.sessionId);
      if (existingAfterCatch) {
        return { success: true, artifact: existingAfterCatch };
      }
      throw err;
    }
  }

  public async findBySessionId(sessionId: string): Promise<SubmissionArtifact | null> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(submissionArtifacts)
      .where(eq(submissionArtifacts.sessionId, sessionId))
      .limit(1);

    if (rows.length === 0 || !rows[0]) return null;
    return this.mapArtifact(rows[0]);
  }

  public async listByOrg(orgId: string): Promise<SubmissionArtifact[]> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(submissionArtifacts)
      .where(eq(submissionArtifacts.organizationId, orgId));
    return rows.map((r) => this.mapArtifact(r));
  }

  public async listAll(): Promise<SubmissionArtifact[]> {
    const db = await this.dbProvider();
    const rows = await db.select().from(submissionArtifacts);
    return rows.map((r) => this.mapArtifact(r));
  }

  private mapArtifact(row: typeof submissionArtifacts.$inferSelect): SubmissionArtifact {
    return {
      id: row.id,
      sessionId: row.sessionId,
      organizationId: row.organizationId,
      templateId: row.templateId,
      candidateName: row.candidateName,
      candidateEmail: row.candidateEmail,
      submittedAt: new Date(row.submittedAt),
      finalCode: row.finalCode,
      starterCode: row.starterCode,
      codeDiff: row.codeDiff as SubmissionArtifact["codeDiff"],
      testExecutionLog: row.testExecutionLog as SubmissionArtifact["testExecutionLog"],
      technicalExplanation: row.technicalExplanation,
      telemetrySummary: row.telemetrySummary as SubmissionArtifact["telemetrySummary"],
      templateContentHash: row.templateContentHash,
      submissionFingerprint: row.submissionFingerprint,
      taskSubmissions: (row.taskSubmissions as SubmissionArtifact["taskSubmissions"]) || {},
      serverAcknowledgedRevision: row.serverAcknowledgedRevision ?? undefined,
      finalizedBy: (row.finalizedBy as any) ?? undefined,
      multiFileChanges: (row.multiFileChanges as any) ?? undefined,
      defenseResponses: (row.defenseResponses as any) ?? undefined,
    };
  }
}
