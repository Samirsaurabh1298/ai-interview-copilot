import { z } from "zod";
import { MembershipRoleSchema } from "./organization.js";

export const AuthUserContextSchema = z.object({
  userId: z.string(),
  organizationId: z.string(),
  memberId: z.string().optional(),
  sessionId: z.string().optional(),
  role: MembershipRoleSchema,
  email: z.string().email().optional(),
});
export type AuthUserContext = z.infer<typeof AuthUserContextSchema>;

export const TokenPayloadSchema = z.object({
  sub: z.string(),
  orgId: z.string(),
  memberId: z.string().optional(),
  sessionId: z.string().optional(),
  role: MembershipRoleSchema,
  email: z.string().email().optional(),
  iat: z.number(),
  exp: z.number(),
});
export type TokenPayload = z.infer<typeof TokenPayloadSchema>;

export const MemberLoginRequestSchema = z.object({
  organizationId: z.string(),
  email: z.string().email(),
});
export type MemberLoginRequest = z.infer<typeof MemberLoginRequestSchema>;

export const CandidateTokenRequestSchema = z.object({
  organizationId: z.string(),
  sessionId: z.string(),
  candidateId: z.string(),
  candidateEmail: z.string().email().optional(),
  validitySeconds: z.number().int().min(60).max(86400).default(3600),
});
export type CandidateTokenRequest = z.infer<typeof CandidateTokenRequestSchema>;

export const AuthTokenResponseSchema = z.object({
  token: z.string(),
  tokenType: z.literal("Bearer").default("Bearer"),
  expiresInSeconds: z.number(),
  user: AuthUserContextSchema,
});
export type AuthTokenResponse = z.infer<typeof AuthTokenResponseSchema>;

