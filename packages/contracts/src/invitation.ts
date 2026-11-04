import { z } from "zod";
import { ChallengeDifficultySchema } from "./template.js";
import { ToolPolicySchema } from "./assessment.js";
import { AssessmentTaskSchema } from "./task.js";

export const InvitationStatusSchema = z.enum([
  "pending",
  "accepted",
  "started",
  "completed",
  "expired",
  "revoked",
]);
export type InvitationStatus = z.infer<typeof InvitationStatusSchema>;

export const CandidateInvitationSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  templateId: z.string(),
  versionId: z.string().optional(),
  candidateEmail: z.string().email(),
  candidateName: z.string().min(2).max(100),
  invitationToken: z.string().min(32),
  status: InvitationStatusSchema.default("pending"),
  expiresAt: z.coerce.date(),
  invitedByMemberId: z.string().optional(),
  sessionId: z.string().optional(),
  createdAt: z.coerce.date().default(() => new Date()),
  acceptedAt: z.coerce.date().optional(),
  startedAt: z.coerce.date().optional(),
});
export type CandidateInvitation = z.infer<typeof CandidateInvitationSchema>;

export const CreateInvitationRequestSchema = z.object({
  organizationId: z.string(),
  templateId: z.string(),
  versionId: z.string().optional(),
  candidateEmail: z.string().email(),
  candidateName: z.string().min(2).max(100),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});
export type CreateInvitationRequest = z.infer<typeof CreateInvitationRequestSchema>;

export const VerifyInvitationResponseSchema = z.object({
  invitation: CandidateInvitationSchema,
  templateTitle: z.string(),
  templateDescription: z.string(),
  targetRole: z.string(),
  difficulty: ChallengeDifficultySchema,
  durationMinutes: z.number(),
  tasks: z.array(AssessmentTaskSchema).default([]),
  toolPolicy: ToolPolicySchema,
  organizationName: z.string(),
});
export type VerifyInvitationResponse = z.infer<typeof VerifyInvitationResponseSchema>;

export const AcceptInvitationRequestSchema = z.object({
  agreedToIntegrityPolicy: z.literal(true, {
    errorMap: () => ({ message: "Candidate must agree to the academic integrity and AI collaboration policy" }),
  }),
});
export type AcceptInvitationRequest = z.infer<typeof AcceptInvitationRequestSchema>;

export const AcceptInvitationResponseSchema = z.object({
  invitation: CandidateInvitationSchema,
  sessionId: z.string(),
  candidateToken: z.string(),
  templateId: z.string(),
  starterCode: z.string(),
  verificationTestCode: z.string(),
  tasks: z.array(AssessmentTaskSchema).default([]),
  toolPolicy: ToolPolicySchema,
  durationMinutes: z.number(),
});
export type AcceptInvitationResponse = z.infer<typeof AcceptInvitationResponseSchema>;

