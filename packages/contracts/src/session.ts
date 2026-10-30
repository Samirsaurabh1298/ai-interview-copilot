import { z } from "zod";
import { ToolPolicySchema } from "./assessment.js";
import { SingleTestResultSchema } from "./validation.js";

export const AssessmentSessionStatusSchema = z.enum([
  "created",
  "in_progress",
  "submitted",
  "expired",
  "terminated",
]);
export type AssessmentSessionStatus = z.infer<typeof AssessmentSessionStatusSchema>;

export const WorkspaceSnapshotSchema = z.object({
  currentCode: z.string(),
  lastSavedAt: z.coerce.date().default(() => new Date()),
  lastTestPassedCount: z.number().int().optional(),
  lastTestTotalCount: z.number().int().optional(),
});
export type WorkspaceSnapshot = z.infer<typeof WorkspaceSnapshotSchema>;

export const AssessmentSessionSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  templateId: z.string(),
  versionId: z.string().optional(),
  invitationId: z.string().optional(),
  candidateEmail: z.string().email(),
  candidateName: z.string().min(2).max(100),
  status: AssessmentSessionStatusSchema.default("created"),
  startedAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  submittedAt: z.coerce.date().optional(),
  durationMinutes: z.number().int().min(15).max(240).default(60),
  gracePeriodSeconds: z.number().int().min(0).max(300).default(60),
  allocatedAiBudgetUsd: z.number().min(0.05).max(5.0).default(0.25),
  consumedAiBudgetUsd: z.number().min(0).default(0),
  toolPolicy: ToolPolicySchema,
  workspaceSnapshot: WorkspaceSnapshotSchema,
  terminationReason: z.string().optional(),
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
});
export type AssessmentSession = z.infer<typeof AssessmentSessionSchema>;

export const CreateSessionRequestSchema = z.object({
  organizationId: z.string(),
  templateId: z.string(),
  candidateEmail: z.string().email(),
  candidateName: z.string().min(2).max(100),
  invitationId: z.string().optional(),
  versionId: z.string().optional(),
  durationMinutes: z.number().int().min(15).max(240).optional(),
  customAiBudgetUsd: z.number().min(0.05).max(5.0).optional(),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

export const SessionHeartbeatResponseSchema = z.object({
  sessionId: z.string(),
  status: AssessmentSessionStatusSchema,
  remainingSeconds: z.number().int(),
  isExpired: z.boolean(),
  inGracePeriod: z.boolean(),
  consumedBudgetUsd: z.number(),
  remainingBudgetUsd: z.number(),
  budgetWarning: z.boolean(),
});
export type SessionHeartbeatResponse = z.infer<typeof SessionHeartbeatResponseSchema>;

export const UpdateWorkspaceRequestSchema = z.object({
  code: z.string(),
  testResults: z.array(SingleTestResultSchema).optional(),
});
export type UpdateWorkspaceRequest = z.infer<typeof UpdateWorkspaceRequestSchema>;

export const SubmitSessionRequestSchema = z.object({
  finalCode: z.string(),
  explanation: z.string().min(1, "Candidate explanation of solution is required"),
  testResults: z.array(SingleTestResultSchema).optional(),
});
export type SubmitSessionRequest = z.infer<typeof SubmitSessionRequestSchema>;
