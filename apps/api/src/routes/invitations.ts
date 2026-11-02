import type { FastifyPluginAsync } from "fastify";
import {
  CreateInvitationRequestSchema,
  AcceptInvitationRequestSchema,
} from "@ai-copilot/contracts";
import type { CandidateInvitationService } from "../services/invitation.js";
import {
  InvitationNotFoundError,
  InvitationExpiredError,
  InvitationInvalidStateError,
} from "../services/invitation.js";
import type { AuthService } from "../services/auth.js";
import {
  TenantAccessDeniedError,
  AuthorizationError,
  isTenantOrAuthForbiddenError,
} from "../services/auth.js";

export class TokenBruteForceGuard {
  private failedAttempts: Map<string, number[]> = new Map();
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts = 10, windowMs = 60_000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  public isRateLimited(key: string): boolean {
    const now = Date.now();
    const timestamps = (this.failedAttempts.get(key) || []).filter(
      (ts) => now - ts < this.windowMs
    );
    this.failedAttempts.set(key, timestamps);
    return timestamps.length >= this.maxAttempts;
  }

  public recordFailure(key: string): void {
    const now = Date.now();
    const timestamps = (this.failedAttempts.get(key) || []).filter(
      (ts) => now - ts < this.windowMs
    );
    timestamps.push(now);
    this.failedAttempts.set(key, timestamps);
  }

  public reset(key: string): void {
    this.failedAttempts.delete(key);
  }
}

export const defaultTokenGuard = new TokenBruteForceGuard();

export const invitationsRoutes: FastifyPluginAsync<{
  invitationService: CandidateInvitationService;
  authService?: AuthService;
  tokenGuard?: TokenBruteForceGuard;
}> = async (fastify, opts) => {
  const { invitationService, authService } = opts;
  const guard = opts.tokenGuard || defaultTokenGuard;

  // 1. Create Candidate Invitation
  fastify.post("/", async (request, reply) => {
    const parse = CreateInvitationRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: "VALIDATION_FAILED",
        issues: parse.error.issues,
      });
    }

    try {
      let memberId: string | undefined;

      // Optional RBAC verification if Authorization header is present
      if (authService && request.headers.authorization) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, parse.data.organizationId);
        if (!["owner", "admin", "interviewer"].includes(auth.role)) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: `Role '${auth.role}' is not authorized to issue candidate invitations`,
          });
        }
        memberId = auth.memberId;
      }

      const invitation = invitationService.createInvitation(parse.data, memberId);
      return reply.status(201).send(invitation);
    } catch (err: unknown) {
      if (isTenantOrAuthForbiddenError(err)) {
        const message = err instanceof Error ? err.message : "Forbidden";
        return reply.status(403).send({ error: "FORBIDDEN", message });
      }
      const message = err instanceof Error ? err.message : "Failed to create invitation";
      return reply.status(400).send({ error: "INVITATION_CREATION_FAILED", message });
    }
  });

  // 2. List Organization Invitations (Tenant Guarded)
  fastify.get("/", async (request, reply) => {
    const query = request.query as { organizationId?: string };
    let orgId = query?.organizationId;

    if (authService && request.headers.authorization) {
      try {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        if (orgId) {
          authService.assertTenantAccess(auth, orgId);
        } else {
          orgId = auth.organizationId;
        }
      } catch (err: unknown) {
        if (isTenantOrAuthForbiddenError(err)) {
          const message = err instanceof Error ? err.message : "Forbidden";
          return reply.status(403).send({ error: "FORBIDDEN", message });
        }
        return reply.status(401).send({ error: "UNAUTHORIZED", message: "Authentication failed" });
      }
    }

    if (!orgId) {
      return reply.status(400).send({
        error: "MISSING_ORGANIZATION_ID",
        message: "Query parameter 'organizationId' or Authorization header is required",
      });
    }

    const invitations = invitationService.listInvitations(orgId);
    return reply.status(200).send({ invitations, total: invitations.length });
  });

  // 3. Verify Invitation Token (Candidate Onboarding Gateway with Rate Limiting)
  fastify.get("/verify/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    const clientKey = request.ip || "global-client";

    if (guard.isRateLimited(clientKey)) {
      return reply.status(429).send({
        error: "TOO_MANY_REQUESTS",
        message: "Too many failed invitation attempts. Rate limit exceeded, please wait.",
      });
    }

    try {
      const details = invitationService.verifyInvitation(token);
      guard.reset(clientKey);
      return reply.status(200).send(details);
    } catch (err: unknown) {
      if (err instanceof InvitationNotFoundError) {
        guard.recordFailure(clientKey);
        return reply.status(404).send({ error: "INVITATION_NOT_FOUND", message: err.message });
      }
      if (err instanceof InvitationExpiredError) {
        return reply.status(410).send({ error: "INVITATION_EXPIRED", message: err.message });
      }
      if (err instanceof InvitationInvalidStateError) {
        return reply.status(409).send({ error: "INVITATION_INVALID", message: err.message });
      }
      throw err;
    }
  });

  // 4. Accept Invitation & Bootstrap Candidate Assessment Workspace
  fastify.post("/accept/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    const clientKey = request.ip || "global-client";

    if (guard.isRateLimited(clientKey)) {
      return reply.status(429).send({
        error: "TOO_MANY_REQUESTS",
        message: "Too many failed invitation attempts. Rate limit exceeded, please wait.",
      });
    }

    const parse = AcceptInvitationRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: "VALIDATION_FAILED",
        issues: parse.error.issues,
      });
    }

    try {
      const sessionBootstrap = invitationService.acceptInvitation(token);
      guard.reset(clientKey);
      return reply.status(200).send(sessionBootstrap);
    } catch (err: unknown) {
      if (err instanceof InvitationNotFoundError) {
        guard.recordFailure(clientKey);
        return reply.status(404).send({ error: "INVITATION_NOT_FOUND", message: err.message });
      }
      if (err instanceof InvitationExpiredError) {
        return reply.status(410).send({ error: "INVITATION_EXPIRED", message: err.message });
      }
      if (err instanceof InvitationInvalidStateError) {
        return reply.status(409).send({ error: "INVITATION_INVALID", message: err.message });
      }
      throw err;
    }
  });

  // 5. Revoke Invitation
  fastify.post("/:invitationId/revoke", async (request, reply) => {
    const { invitationId } = request.params as { invitationId: string };
    const query = request.query as { organizationId?: string };
    const orgId = query?.organizationId;

    if (!orgId) {
      return reply.status(400).send({
        error: "MISSING_ORGANIZATION_ID",
        message: "Query parameter 'organizationId' is required",
      });
    }

    try {
      if (authService && request.headers.authorization) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, orgId);
        if (!["owner", "admin"].includes(auth.role)) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: `Role '${auth.role}' cannot revoke invitations`,
          });
        }
      }

      const revoked = invitationService.revokeInvitation(orgId, invitationId);
      return reply.status(200).send(revoked);
    } catch (err: unknown) {
      if (err instanceof TenantAccessDeniedError || err instanceof AuthorizationError) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err.message });
      }
      if (err instanceof InvitationNotFoundError) {
        return reply.status(404).send({ error: "INVITATION_NOT_FOUND", message: err.message });
      }
      throw err;
    }
  });
};

