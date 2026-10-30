import type { FastifyPluginAsync } from "fastify";
import {
  MemberLoginRequestSchema,
  CandidateTokenRequestSchema,
} from "@ai-copilot/contracts";
import type { AuthService } from "../services/auth.js";
import type { OrganizationService } from "../services/organization.js";

export const authRoutes: FastifyPluginAsync<{
  authService: AuthService;
  orgService: OrganizationService;
}> = async (fastify, opts) => {
  const { authService, orgService } = opts;

  // 1. Member Login / Token Exchange
  fastify.post("/token", async (request, reply) => {
    const parse = MemberLoginRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: "VALIDATION_FAILED",
        issues: parse.error.issues,
      });
    }

    const { organizationId, email } = parse.data;
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

  // 2. Candidate Ephemeral Token Issuance (Admin/Interviewer permission required)
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

  // 3. Current Authenticated Identity Profile
  fastify.get(
    "/me",
    { preHandler: [authService.requireAuth()] },
    async (request, reply) => {
      const auth = (request as any).auth;
      return reply.status(200).send({ user: auth });
    }
  );
};
