import { eq, and } from "drizzle-orm";
import { getDb, type AppDatabase } from "../db/connection.js";
import { assessmentVersions } from "../db/schema.js";
import type { AssessmentVersion } from "@ai-copilot/contracts";

export class VersioningRepository {
  constructor(private dbProvider: () => Promise<AppDatabase> = getDb) {}

  public async create(version: AssessmentVersion): Promise<AssessmentVersion> {
    const db = await this.dbProvider();
    await db.insert(assessmentVersions).values({
      id: version.id,
      templateId: version.templateId,
      organizationId: version.organizationId,
      versionNumber: version.versionNumber,
      contentHash: version.contentHash,
      changelogNotes: version.changelogNotes ?? null,
      snapshot: version.snapshot,
      isLocked: version.isLocked,
      publishedByMemberId: version.publishedByMemberId ?? null,
      publishedAt: version.publishedAt,
    });
    return version;
  }

  public async findById(id: string): Promise<AssessmentVersion | null> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(assessmentVersions)
      .where(eq(assessmentVersions.id, id))
      .limit(1);

    if (rows.length === 0 || !rows[0]) return null;
    return this.mapVersion(rows[0]);
  }

  public async listByTemplate(templateId: string): Promise<AssessmentVersion[]> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(assessmentVersions)
      .where(eq(assessmentVersions.templateId, templateId));
    return rows.map((r) => this.mapVersion(r));
  }

  public async findByTemplateAndNumber(
    templateId: string,
    versionNumber: string
  ): Promise<AssessmentVersion | null> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(assessmentVersions)
      .where(
        and(
          eq(assessmentVersions.templateId, templateId),
          eq(assessmentVersions.versionNumber, versionNumber)
        )
      )
      .limit(1);

    if (rows.length === 0 || !rows[0]) return null;
    return this.mapVersion(rows[0]);
  }

  private mapVersion(row: typeof assessmentVersions.$inferSelect): AssessmentVersion {
    return {
      id: row.id,
      templateId: row.templateId,
      organizationId: row.organizationId,
      versionNumber: row.versionNumber,
      contentHash: row.contentHash,
      changelogNotes: row.changelogNotes ?? undefined,
      snapshot: row.snapshot as AssessmentVersion["snapshot"],
      isLocked: true,
      publishedByMemberId: row.publishedByMemberId ?? undefined,
      publishedAt: new Date(row.publishedAt),
    };
  }
}

