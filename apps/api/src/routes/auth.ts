import type { FastifyPluginAsync } from "fastify";
import {
  MemberLoginRequestSchema,
  CandidateTokenRequestSchema,
  RequestMagicLinkRequestSchema,
  VerifyMagicLinkRequestSchema,
} from "@ai-copilot/contracts";
import type { AuthService } from "../services/auth.js";
import type { OrganizationService } from "../services/organization.js";
import { MagicLinkService, MagicLinkError } from "../services/magic-link.js";

export const authRoutes: FastifyPluginAsync<{
  authService: AuthService;
  orgService: OrganizationService;
  magicLinkService?: MagicLinkService;
}> = async (fastify, opts) => {
  const { authService, orgService } = opts;
  const magicLinkService =
    opts.magicLinkService || new MagicLinkService(orgService);

  // 1. Single-Use Magic Login Link Request (Company Admin / Member Production Auth)
  fastify.post("/magic-link/request", async (request, reply) => {
    const parse = RequestMagicLinkRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: "VALIDATION_FAILED",
        issues: parse.error.issues,
      });
    }

    try {
      const result = await magicLinkService.requestMagicLink(
        parse.data.email,
        parse.data.organizationId
      );
      return reply.status(200).send(result);
    } catch (err: unknown) {
      if (err instanceof MagicLinkError) {
        return reply.status(err.statusCode).send({
          error: err.code,
          message: err.message,
        });
      }
      throw err;
    }
  });

  // 2. Single-Use Magic Login Link Verification (Burns token on use)
  fastify.post("/magic-link/verify", async (request, reply) => {
    const parse = VerifyMagicLinkRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: "VALIDATION_FAILED",
        issues: parse.error.issues,
      });
    }

    try {
      const record = await magicLinkService.verifyAndConsumeToken(
        parse.data.token
      );
      const members = orgService.listMembers(record.organizationId);
      const member = members.find((m) => m.id === record.memberId);

      if (!member || member.status !== "active") {
        return reply.status(401).send({
          error: "MEMBER_INACTIVE_OR_REMOVED",
          message:
            "The account associated with this login link is no longer active.",
        });
      }

      const tokenResponse = authService.createMemberToken(member);
      return reply.status(200).send(tokenResponse);
    } catch (err: unknown) {
      if (err instanceof MagicLinkError) {
        return reply.status(err.statusCode).send({
          error: err.code,
          message: err.message,
        });
      }
      throw err;
    }
  });

  // 3. Member Login / Token Exchange
  fastify.post("/token", async (request, reply) => {
    const parse = MemberLoginRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: "VALIDATION_FAILED",
        issues: parse.error.issues,
      });
    }

    const { organizationId, email } = parse.data;

    // Production Hardening: Persona switching without credentials is strictly disabled in production
    if (process.env.NODE_ENV === "production" && !process.env.ALLOW_DEMO_LOGIN) {
      return reply.status(403).send({
        error: "DEMO_LOGIN_DISABLED_IN_PRODUCTION",
        message: "Direct persona token generation without credentials is disabled in production environments.",
      });
    }

    const org = orgService.getOrganizationById(organizationId);
    if (!org) {
      return reply.status(404).send({
        error: "ORGANIZATION_NOT_FOUND",
        message: `Organization '${organizationId}' not found`,
      });
    }

    const members = orgService.listMembers(organizationId);
    const member = members.find(
      (m) => m.email.toLowerCase() === email.toLowerCase().trim() && m.status === "active"
    );

    if (!member) {
      return reply.status(401).send({
        error: "INVALID_CREDENTIALS",
        message: `No active member with email '${email}' in organization '${org.name}'`,
      });
    }

    const tokenResponse = authService.createMemberToken(member);
    return reply.status(200).send(tokenResponse);
  });

  // 4. Candidate Ephemeral Token Issuance (Admin/Interviewer permission required)
  fastify.post(
    "/candidate-token",
    { preHandler: [authService.requireRole(["owner", "admin", "interviewer"])] },
    async (request, reply) => {
      const parse = CandidateTokenRequestSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({
          error: "VALIDATION_FAILED",
          issues: parse.error.issues,
        });
      }

      const auth = (request as any).auth;
      // Tenant boundary guard: Interviewer cannot issue tokens for a different organization
      authService.assertTenantAccess(auth, parse.data.organizationId);

      const tokenResponse = authService.createCandidateToken(parse.data);
      return reply.status(201).send(tokenResponse);
    }
  );

  // 5. Current Authenticated Identity Profile
  fastify.get(
    "/me",
    { preHandler: [authService.requireAuth()] },
    async (request, reply) => {
      const auth = (request as any).auth;
      return reply.status(200).send({ user: auth });
    }
  );

  // 6. Member Logout & Token Invalidation
  fastify.post(
    "/logout",
    { preHandler: [authService.requireAuth()] },
    async (request, reply) => {
      const auth = (request as any).auth;
      if (auth.memberId) {
        magicLinkService.revokeAllMemberTokens(auth.memberId);
      }
      return reply
        .status(200)
        .send({ success: true, message: "Logged out successfully." });
    }
  );
};

