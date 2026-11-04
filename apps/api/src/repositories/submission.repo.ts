import { eq } from "drizzle-orm";
import { getDb, type AppDatabase } from "../db/connection.js";
import { submissionArtifacts } from "../db/schema.js";
import type { SubmissionArtifact } from "@ai-copilot/contracts";

export class SubmissionRepository {
  constructor(private dbProvider: () => Promise<AppDatabase> = getDb) {}

  public async create(artifact: SubmissionArtifact): Promise<SubmissionArtifact> {
    const db = await this.dbProvider();
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
    });
    return artifact;
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
    };
  }
}
