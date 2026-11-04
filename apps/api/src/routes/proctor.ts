import type { FastifyPluginAsync } from "fastify";
import type { IntegrityService } from "../services/integrity.js";
import type { AuthService } from "../services/auth.js";
import type { AssessmentSessionService } from "../services/session.js";
import {
  CreateProctorIncidentRequestSchema,
  IntegrityIncident,
} from "@ai-copilot/contracts";
import {
  SessionNotFoundError,
  SessionInvalidStateError,
} from "../services/session.js";
import {
  TenantAccessDeniedError,
  AuthorizationError,
} from "../services/auth.js";

export interface ProctorRoutesOptions {
  integrityService: IntegrityService;
  sessionService: AssessmentSessionService;
  authService?: AuthService;
}

export const proctorRoutes: FastifyPluginAsync<ProctorRoutesOptions> = async (
  fastify,
  options
) => {
  const { integrityService, sessionService, authService } = options;

  function assertInterviewerAuth(authHeader?: string, targetOrgId?: string) {
    if (!authService || !authHeader) return { role: "interviewer", organizationId: targetOrgId || "" };
    const auth = authService.parseAuthHeader(authHeader);
    if (targetOrgId) {
      authService.assertTenantAccess(auth, targetOrgId);
    }
    if (!["owner", "admin", "interviewer"].includes(auth.role)) {
      throw new AuthorizationError(`Role '${auth.role}' is not authorized for proctor actions`);
    }
    return auth;
  }

  // 1. GET /api/v1/sessions/:sessionId/integrity — Live Integrity Risk Score & Metrics
  fastify.get("/:sessionId/integrity", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    try {
      const session = sessionService.getSession(sessionId);

      if (authService && request.headers.authorization) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, session.organizationId);
      }

      const report = await integrityService.getIntegrityReport(sessionId);
      return reply.status(200).send(report);
    } catch (err: unknown) {
      if (err instanceof SessionNotFoundError) {
        return reply.status(404).send({ error: "SESSION_NOT_FOUND", message: err.message });
      }
      if (err instanceof TenantAccessDeniedError || err instanceof AuthorizationError) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err.message });
      }
      throw err;
    }
  });

  // 2. POST /api/v1/sessions/:sessionId/incidents — Log Proctor Incident / Integrity Flag
  fastify.post("/:sessionId/incidents", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    try {
      const session = sessionService.getSession(sessionId);
      const auth = assertInterviewerAuth(request.headers.authorization, session.organizationId);

      const parsed = CreateProctorIncidentRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "INVALID_PROCTOR_INCIDENT",
          details: parsed.error.issues,
        });
      }

      const incident = await integrityService.logIncident(
        sessionId,
        parsed.data,
        (auth as any).email || "Staff Proctor"
      );

      return reply.status(201).send(incident);
    } catch (err: unknown) {
      if (err instanceof SessionNotFoundError) {
        return reply.status(404).send({ error: "SESSION_NOT_FOUND", message: err.message });
      }
      if (err instanceof TenantAccessDeniedError || err instanceof AuthorizationError) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err.message });
      }
      throw err;
    }
  });

  // 3. GET /api/v1/sessions/:sessionId/incidents — List Proctor Incidents for Session
  fastify.get("/:sessionId/incidents", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    try {
      const session = sessionService.getSession(sessionId);

      if (authService && request.headers.authorization) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, session.organizationId);
      }

      const incidents = await integrityService.listIncidents(sessionId);
      return reply.status(200).send({ incidents, total: incidents.length });
    } catch (err: unknown) {
      if (err instanceof SessionNotFoundError) {
        return reply.status(404).send({ error: "SESSION_NOT_FOUND", message: err.message });
      }
      if (err instanceof TenantAccessDeniedError || err instanceof AuthorizationError) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err.message });
      }
      throw err;
    }
  });

  // 4. POST /api/v1/sessions/:sessionId/incidents/:incidentId/resolve — Resolve Incident
  fastify.post("/:sessionId/incidents/:incidentId/resolve", async (request, reply) => {
    const { sessionId, incidentId } = request.params as {
      sessionId: string;
      incidentId: string;
    };

    try {
      const session = sessionService.getSession(sessionId);
      assertInterviewerAuth(request.headers.authorization, session.organizationId);

      const resolved = await integrityService.resolveIncident(incidentId);
      if (!resolved) {
        return reply.status(404).send({
          error: "INCIDENT_NOT_FOUND",
          message: `Proctor incident '${incidentId}' not found`,
        });
      }

      return reply.status(200).send(resolved);
    } catch (err: unknown) {
      if (err instanceof SessionNotFoundError) {
        return reply.status(404).send({ error: "SESSION_NOT_FOUND", message: err.message });
      }
      if (err instanceof TenantAccessDeniedError || err instanceof AuthorizationError) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err.message });
      }
      throw err;
    }
  });
};
