import { z } from "zod";
import { ChallengeDifficultySchema } from "./template.js";
import { ToolPolicySchema } from "./assessment.js";

export const AssessmentVersionSnapshotSchema = z.object({
  title: z.string(),
  description: z.string(),
  targetRole: z.string(),
  difficulty: ChallengeDifficultySchema,
  language: z.enum(["typescript", "javascript", "python"]),
  durationMinutes: z.number(),
  starterCode: z.string(),
  solutionCode: z.string().optional(),
  verificationTestCode: z.string(),
  toolPolicy: ToolPolicySchema,
  rubricDimensionWeights: z.record(z.string(), z.number()),
});
export type AssessmentVersionSnapshot = z.infer<typeof AssessmentVersionSnapshotSchema>;

export const AssessmentVersionSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  organizationId: z.string(),
  versionNumber: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "Version must follow semantic versioning format (e.g. 1.0.0)"),
  contentHash: z.string().length(64, "Content hash must be a 64-character SHA-256 hex string"),
  changelogNotes: z.string().optional(),
  snapshot: AssessmentVersionSnapshotSchema,
  isLocked: z.literal(true).default(true),
  publishedByMemberId: z.string().optional(),
  publishedAt: z.coerce.date().default(() => new Date()),
});
export type AssessmentVersion = z.infer<typeof AssessmentVersionSchema>;

export const PublishVersionRequestSchema = z.object({
  templateId: z.string(),
  organizationId: z.string(),
  versionType: z.enum(["major", "minor", "patch"]).default("minor"),
  changelogNotes: z.string().min(3, "Changelog description is required for audit trail"),
});
export type PublishVersionRequest = z.infer<typeof PublishVersionRequestSchema>;
