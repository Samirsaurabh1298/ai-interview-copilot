import { eq, and } from "drizzle-orm";
import { getDb, type AppDatabase } from "../db/connection.js";
import { assessmentTemplates } from "../db/schema.js";
import type { AssessmentTemplate } from "@ai-copilot/contracts";

export class TemplateRepository {
  constructor(private dbProvider: () => Promise<AppDatabase> = getDb) {}

  public async create(template: AssessmentTemplate): Promise<AssessmentTemplate> {
    const db = await this.dbProvider();
    await db.insert(assessmentTemplates).values({
      id: template.id,
      organizationId: template.organizationId,
      title: template.title,
      slug: template.slug,
      description: template.description,
      targetRole: template.targetRole,
      difficulty: template.difficulty,
      language: template.language,
      durationMinutes: template.durationMinutes,
      attemptDurationMinutes: template.attemptDurationMinutes || template.durationMinutes || 90,
      submissionDeadlineDays: template.submissionDeadlineDays || 7,
      defaultAiBudgetUsd: template.defaultAiBudgetUsd.toFixed(4),
      starterCode: template.starterCode,
      solutionCode: template.solutionCode ?? null,
      verificationTestCode: template.verificationTestCode,
      tasks: (template.tasks as any) || [],
      toolPolicy: template.toolPolicy,
      rubricDimensionWeights: template.rubricDimensionWeights,
      status: template.status,
      createdByMemberId: template.createdByMemberId ?? null,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    });
    return template;
  }

  public async findById(orgId: string, templateId: string): Promise<AssessmentTemplate | null> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(assessmentTemplates)
      .where(
        and(
          eq(assessmentTemplates.organizationId, orgId),
          eq(assessmentTemplates.id, templateId)
        )
      )
      .limit(1);

    if (rows.length === 0 || !rows[0]) return null;
    return this.mapTemplate(rows[0]);
  }

  public async findBySlug(orgId: string, slug: string): Promise<AssessmentTemplate | null> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(assessmentTemplates)
      .where(
        and(
          eq(assessmentTemplates.organizationId, orgId),
          eq(assessmentTemplates.slug, slug.toLowerCase().trim())
        )
      )
      .limit(1);

    if (rows.length === 0 || !rows[0]) return null;
    return this.mapTemplate(rows[0]);
  }

  public async list(orgId: string): Promise<AssessmentTemplate[]> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(assessmentTemplates)
      .where(eq(assessmentTemplates.organizationId, orgId));
    return rows.map((r) => this.mapTemplate(r));
  }

  public async listAll(): Promise<AssessmentTemplate[]> {
    const db = await this.dbProvider();
    const rows = await db.select().from(assessmentTemplates);
    return rows.map((r) => this.mapTemplate(r));
  }

  public async update(
    orgId: string,
    templateId: string,
    patch: Partial<Record<keyof AssessmentTemplate, unknown>>
  ): Promise<AssessmentTemplate | null> {
    const db = await this.dbProvider();
    const now = new Date();

    const updateValues: Record<string, unknown> = {
      updatedAt: now,
    };

    if (patch.title !== undefined) updateValues.title = patch.title;
    if (patch.description !== undefined) updateValues.description = patch.description;
    if (patch.targetRole !== undefined) updateValues.targetRole = patch.targetRole;
    if (patch.difficulty !== undefined) updateValues.difficulty = patch.difficulty;
    if (patch.language !== undefined) updateValues.language = patch.language;
    if (patch.durationMinutes !== undefined) updateValues.durationMinutes = patch.durationMinutes;
    if (patch.attemptDurationMinutes !== undefined)
      updateValues.attemptDurationMinutes = patch.attemptDurationMinutes;
    if (patch.submissionDeadlineDays !== undefined)
      updateValues.submissionDeadlineDays = patch.submissionDeadlineDays;
    if (patch.tasks !== undefined) updateValues.tasks = patch.tasks;
    if (patch.defaultAiBudgetUsd !== undefined)
      updateValues.defaultAiBudgetUsd = Number(patch.defaultAiBudgetUsd).toFixed(4);
    if (patch.starterCode !== undefined) updateValues.starterCode = patch.starterCode;
    if (patch.solutionCode !== undefined) updateValues.solutionCode = patch.solutionCode;
    if (patch.verificationTestCode !== undefined)
      updateValues.verificationTestCode = patch.verificationTestCode;
    if (patch.toolPolicy !== undefined) updateValues.toolPolicy = patch.toolPolicy;
    if (patch.rubricDimensionWeights !== undefined)
      updateValues.rubricDimensionWeights = patch.rubricDimensionWeights;
    if (patch.status !== undefined) updateValues.status = patch.status;

    const rows = await db
      .update(assessmentTemplates)
      .set(updateValues)
      .where(
        and(
          eq(assessmentTemplates.organizationId, orgId),
          eq(assessmentTemplates.id, templateId)
        )
      )
      .returning();

    if (rows.length === 0 || !rows[0]) return null;
    return this.mapTemplate(rows[0]);
  }

  private mapTemplate(row: typeof assessmentTemplates.$inferSelect): AssessmentTemplate {
    return {
      id: row.id,
      organizationId: row.organizationId,
      title: row.title,
      slug: row.slug,
      description: row.description,
      targetRole: row.targetRole,
      difficulty: row.difficulty as AssessmentTemplate["difficulty"],
      language: row.language as AssessmentTemplate["language"],
      durationMinutes: row.durationMinutes,
      attemptDurationMinutes: row.attemptDurationMinutes || row.durationMinutes || 90,
      submissionDeadlineDays: row.submissionDeadlineDays || 7,
      defaultAiBudgetUsd: Number(row.defaultAiBudgetUsd),
      starterCode: row.starterCode,
      solutionCode: row.solutionCode ?? undefined,
      verificationTestCode: row.verificationTestCode,
      tasks: (row.tasks as any) || [],
      toolPolicy: row.toolPolicy as AssessmentTemplate["toolPolicy"],
      rubricDimensionWeights: row.rubricDimensionWeights as AssessmentTemplate["rubricDimensionWeights"],
      status: row.status as AssessmentTemplate["status"],
      createdByMemberId: row.createdByMemberId ?? undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
