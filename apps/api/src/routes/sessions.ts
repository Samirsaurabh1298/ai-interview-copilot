import type { FastifyPluginAsync } from "fastify";
import {
  CreateSessionRequestSchema,
  UpdateWorkspaceRequestSchema,
  SubmitSessionRequestSchema,
} from "@ai-copilot/contracts";
import type { AssessmentSessionService } from "../services/session.js";
import {
  SessionNotFoundError,
  SessionExpiredError,
  SessionInvalidStateError,
} from "../services/session.js";
import type { AuthService } from "../services/auth.js";
import {
  TenantAccessDeniedError,
  AuthorizationError,
  isTenantOrAuthForbiddenError,
} from "../services/auth.js";
import type { SubmissionService } from "../services/submission.js";
import { SubmissionNotFoundError } from "../services/submission.js";

export const sessionsRoutes: FastifyPluginAsync<{
  sessionService: AssessmentSessionService;
  authService?: AuthService;
  submissionService?: SubmissionService;
}> = async (fastify, opts) => {
  const { sessionService, authService, submissionService } = opts;

  // 1. Create Assessment Session
  fastify.post("/", async (request, reply) => {
    const parse = CreateSessionRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: "VALIDATION_FAILED",
        issues: parse.error.issues,
      });
    }

    try {
      if (authService && request.headers.authorization) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, parse.data.organizationId);
      }

      const session = sessionService.createSession(parse.data);
      return reply.status(201).send(session);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create assessment session";
      return reply.status(400).send({ error: "SESSION_CREATION_FAILED", message });
    }
  });

  // 2. Get Session by ID
  fastify.get("/:sessionId", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    try {
      const session = sessionService.getSession(sessionId);

      if (authService && request.headers.authorization) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, session.organizationId);
        // Candidate token scoping: candidate can only view their own session
        if (auth.role === "candidate" && auth.sessionId !== sessionId) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: "Candidate token is not authorized to access this session",
          });
        }
      }

      return reply.status(200).send(session);
    } catch (err: unknown) {
      if (err instanceof SessionNotFoundError) {
        return reply.status(404).send({ error: "SESSION_NOT_FOUND", message: err.message });
      }
      if (isTenantOrAuthForbiddenError(err)) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err instanceof Error ? err.message : "Forbidden" });
      }
      throw err;
    }
  });

  // 3. Candidate Session Heartbeat & Expiration Watchdog
  fastify.get("/:sessionId/heartbeat", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    try {
      const heartbeat = sessionService.heartbeat(sessionId);
      return reply.status(200).send(heartbeat);
    } catch (err: unknown) {
      if (err instanceof SessionNotFoundError) {
        return reply.status(404).send({ error: "SESSION_NOT_FOUND", message: err.message });
      }
      throw err;
    }
  });

  // 4. Autosave Workspace Code
  fastify.patch("/:sessionId/workspace", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const parse = UpdateWorkspaceRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: "VALIDATION_FAILED",
        issues: parse.error.issues,
      });
    }

    try {
      const session = sessionService.getSession(sessionId);
      if (authService && request.headers.authorization) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, session.organizationId);
        authService.assertSessionAccess(auth, sessionId);
      }

      const updated = sessionService.updateWorkspaceCode(sessionId, parse.data);
      return reply.status(200).send({
        sessionId: updated.id,
        lastSavedAt: updated.workspaceSnapshot.lastSavedAt,
        status: updated.status,
      });
    } catch (err: unknown) {
      if (err instanceof SessionNotFoundError) {
        return reply.status(404).send({ error: "SESSION_NOT_FOUND", message: err.message });
      }
      if (isTenantOrAuthForbiddenError(err)) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err instanceof Error ? err.message : "Forbidden" });
      }
      if (err instanceof SessionExpiredError) {
        return reply.status(410).send({ error: "SESSION_EXPIRED", message: err.message });
      }
      if (err instanceof SessionInvalidStateError) {
        return reply.status(409).send({ error: "INVALID_STATE", message: err.message });
      }
      throw err;
    }
  });

  // 5. Submit Session Solution & Immutable Artifact Bundling (Task 14)
  fastify.post("/:sessionId/submit", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const rawBody = (request.body as Record<string, unknown>) || {};
    const explanationText =
      (typeof rawBody.technicalExplanation === "string" && rawBody.technicalExplanation) ||
      (typeof rawBody.explanation === "string" && rawBody.explanation) ||
      "";

    const normalizedBody = {
      ...rawBody,
      explanation: explanationText || "Candidate submitted assessment solution.",
    };

    const parse = SubmitSessionRequestSchema.safeParse(normalizedBody);
    if (!parse.success) {
      return reply.status(400).send({
        error: "VALIDATION_FAILED",
        issues: parse.error.issues,
      });
    }

    try {
      const session = sessionService.getSession(sessionId);
      if (authService && request.headers.authorization) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, session.organizationId);
        authService.assertSessionAccess(auth, sessionId);
      }

      if (submissionService) {
        const artifact = await submissionService.submitAssessment(sessionId, {
          finalCode: parse.data.finalCode,
          technicalExplanation: normalizedBody.explanation,
          taskSubmissions: rawBody.taskSubmissions,
        });

        return reply.status(200).send({
          submissionId: artifact.id,
          sessionId: artifact.sessionId,
          status: "submitted",
          submittedAt: artifact.submittedAt,
          submissionFingerprint: artifact.submissionFingerprint,
          artifact,
        });
      }

      const submitted = sessionService.submitSession(sessionId, parse.data);
      return reply.status(200).send({
        sessionId: submitted.id,
        status: submitted.status,
        submittedAt: submitted.submittedAt,
      });
    } catch (err: unknown) {
      if (err instanceof SessionNotFoundError) {
        return reply.status(404).send({ error: "SESSION_NOT_FOUND", message: err.message });
      }
      if (isTenantOrAuthForbiddenError(err)) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err instanceof Error ? err.message : "Forbidden" });
      }
      if (err instanceof SessionExpiredError) {
        return reply.status(410).send({ error: "SESSION_EXPIRED", message: err.message });
      }
      if (err instanceof SessionInvalidStateError) {
        return reply.status(409).send({ error: "INVALID_STATE", message: err.message });
      }
      throw err;
    }
  });

  // 5b. Retrieve Immutable Submission Artifact (Task 14)
  fastify.get("/:sessionId/submission", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    try {
      const session = sessionService.getSession(sessionId);

      if (authService && request.headers.authorization) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, session.organizationId);
        if (auth.role === "candidate" && auth.sessionId !== sessionId) {
          return reply.status(403).send({ error: "FORBIDDEN", message: "Candidate cannot inspect another session's submission" });
        }
      }

      if (!submissionService) {
        return reply.status(501).send({ error: "SUBMISSION_SERVICE_NOT_CONFIGURED" });
      }

      const artifact = submissionService.getSubmission(sessionId);
      return reply.status(200).send({ artifact });
    } catch (err: unknown) {
      if (err instanceof SessionNotFoundError || err instanceof SubmissionNotFoundError) {
        return reply.status(404).send({ error: "SUBMISSION_NOT_FOUND", message: err.message });
      }
      if (isTenantOrAuthForbiddenError(err)) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err instanceof Error ? err.message : "Forbidden" });
      }
      throw err;
    }
  });

  // 6. Proctor Controls: Pause Session (Task 15 & LOOP 10.0.1 Invariant 4)
  fastify.post("/:sessionId/pause", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = (request.body as { reason?: string }) || {};

    try {
      const session = sessionService.getSession(sessionId);

      if (!request.headers.authorization) {
        return reply.status(401).send({
          error: "UNAUTHORIZED",
          message: "Authorization token required to pause candidate sessions",
        });
      }

      if (authService) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, session.organizationId);
        if (!["owner", "admin", "interviewer"].includes(auth.role)) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: `Role '${auth.role}' is not authorized to pause candidate sessions`,
          });
        }
      }

      const paused = sessionService.pauseSession(sessionId, body.reason);
      return reply.status(200).send(paused);
    } catch (err: unknown) {
      if (err instanceof SessionNotFoundError) {
        return reply.status(404).send({ error: "SESSION_NOT_FOUND", message: err.message });
      }
      if (isTenantOrAuthForbiddenError(err)) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err instanceof Error ? err.message : "Forbidden" });
      }
      if (err instanceof SessionInvalidStateError) {
        return reply.status(409).send({ error: "INVALID_STATE", message: err.message });
      }
      throw err;
    }
  });

  // 6b. Proctor Controls: Resume Session & Extend Deadline (Task 15 & LOOP 10.0.1 Invariant 4)
  fastify.post("/:sessionId/resume", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    try {
      const session = sessionService.getSession(sessionId);

      if (!request.headers.authorization) {
        return reply.status(401).send({
          error: "UNAUTHORIZED",
          message: "Authorization token required to resume candidate sessions",
        });
      }

      if (authService) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, session.organizationId);
        if (!["owner", "admin", "interviewer"].includes(auth.role)) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: `Role '${auth.role}' is not authorized to resume candidate sessions`,
          });
        }
      }

      const resumed = sessionService.resumeSession(sessionId);
      return reply.status(200).send(resumed);
    } catch (err: unknown) {
      if (err instanceof SessionNotFoundError) {
        return reply.status(404).send({ error: "SESSION_NOT_FOUND", message: err.message });
      }
      if (isTenantOrAuthForbiddenError(err)) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err instanceof Error ? err.message : "Forbidden" });
      }
      if (err instanceof SessionInvalidStateError) {
        return reply.status(409).send({ error: "INVALID_STATE", message: err.message });
      }
      throw err;
    }
  });

  // 6c. Candidate Data Erasure & Privacy Compliance (LOOP 10.0.1 Invariant 6)
  fastify.delete("/:sessionId/data", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    try {
      const session = sessionService.getSession(sessionId);

      if (!request.headers.authorization) {
        return reply.status(401).send({
          error: "UNAUTHORIZED",
          message: "Authorization token required to request candidate data erasure",
        });
      }

      if (authService) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, session.organizationId);
        // Only organization owner/admin or the candidate themselves can request data erasure
        if (
          auth.role !== "owner" &&
          auth.role !== "admin" &&
          (auth.role !== "candidate" || auth.sessionId !== sessionId)
        ) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: `Role '${auth.role}' is not authorized to delete candidate data for this session`,
          });
        }
      }

      const erasureResult = await sessionService.deleteSessionData(sessionId);
      return reply.status(200).send(erasureResult);
    } catch (err: unknown) {
      if (err instanceof SessionNotFoundError) {
        return reply.status(404).send({ error: "SESSION_NOT_FOUND", message: err.message });
      }
      if (isTenantOrAuthForbiddenError(err)) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err instanceof Error ? err.message : "Forbidden" });
      }
      throw err;
    }
  });

  // 7. Terminate Session (Admin / Interviewer emergency control)
  fastify.post("/:sessionId/terminate", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = (request.body as { reason?: string }) || {};
    const reason = body.reason || "Terminated by interviewer";

    try {
      const session = sessionService.getSession(sessionId);

      if (authService && request.headers.authorization) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, session.organizationId);
        if (!["owner", "admin", "interviewer"].includes(auth.role)) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: `Role '${auth.role}' is not authorized to terminate candidate sessions`,
          });
        }
      }

      const terminated = sessionService.terminateSession(sessionId, reason);
      return reply.status(200).send(terminated);
    } catch (err: unknown) {
      if (err instanceof SessionNotFoundError) {
        return reply.status(404).send({ error: "SESSION_NOT_FOUND", message: err.message });
      }
      if (isTenantOrAuthForbiddenError(err)) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err instanceof Error ? err.message : "Forbidden" });
      }
      throw err;
    }
  });

  // 7. List Sessions for Organization (Tenant Guarded)
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
        if (err instanceof TenantAccessDeniedError || err instanceof AuthorizationError) {
          return reply.status(403).send({ error: "FORBIDDEN", message: err.message });
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

    const sessions = sessionService.listSessionsForOrg(orgId);
    return reply.status(200).send({ sessions, total: sessions.length });
  });
};

