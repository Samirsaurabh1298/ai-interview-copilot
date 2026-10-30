import { z } from "zod";

export const OrganizationPlanSchema = z.enum(["pilot", "standard", "enterprise"]);
export type OrganizationPlan = z.infer<typeof OrganizationPlanSchema>;

export const MembershipRoleSchema = z.enum([
  "owner",
  "admin",
  "interviewer",
  "reviewer",
  "candidate",
]);
export type MembershipRole = z.infer<typeof MembershipRoleSchema>;

export const MembershipStatusSchema = z.enum(["active", "invited", "suspended"]);
export type MembershipStatus = z.infer<typeof MembershipStatusSchema>;

export const OrganizationSettingsSchema = z.object({
  defaultAiBudgetUsd: z.number().min(0.05).max(5.0).default(0.25),
  enforcePatchReview: z.boolean().default(true),
  allowedProviders: z.array(z.string()).default(["openai", "groq"]),
  maxConcurrentSessions: z.number().int().min(1).default(10),
});
export type OrganizationSettings = z.infer<typeof OrganizationSettingsSchema>;

export const OrganizationSchema = z.object({
  id: z.string(),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  name: z.string().min(2).max(100),
  plan: OrganizationPlanSchema.default("pilot"),
  settings: OrganizationSettingsSchema.default({}),
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
});
export type Organization = z.infer<typeof OrganizationSchema>;

export const OrganizationMemberSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  role: MembershipRoleSchema,
  status: MembershipStatusSchema.default("active"),
  invitedByMemberId: z.string().optional(),
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
});
export type OrganizationMember = z.infer<typeof OrganizationMemberSchema>;

export const CreateOrganizationRequestSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  ownerEmail: z.string().email(),
  ownerName: z.string().min(1),
  plan: OrganizationPlanSchema.optional().default("pilot"),
});
export type CreateOrganizationRequest = z.infer<typeof CreateOrganizationRequestSchema>;

export const InviteMemberRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: MembershipRoleSchema,
});
export type InviteMemberRequest = z.infer<typeof InviteMemberRequestSchema>;

export const UpdateMemberRoleRequestSchema = z.object({
  role: MembershipRoleSchema,
});
export type UpdateMemberRoleRequest = z.infer<typeof UpdateMemberRoleRequestSchema>;

export const TenantContextSchema = z.object({
  organizationId: z.string(),
  memberId: z.string(),
  userId: z.string(),
  role: MembershipRoleSchema,
});
export type TenantContext = z.infer<typeof TenantContextSchema>;
