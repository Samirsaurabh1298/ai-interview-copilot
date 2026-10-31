import type { FastifyPluginAsync } from "fastify";
import {
  IngestEventsRequestSchema,
} from "@ai-copilot/contracts";
import type { SessionEventsService } from "../services/session-events.js";
import type { AssessmentSessionService } from "../services/session.js";
import type { AuthService } from "../services/auth.js";
import {
  AuthenticationError,
  AuthorizationError,
  TenantAccessDeniedError,
} from "../services/auth.js";
import { SessionNotFoundError } from "../services/session.js";

export const sessionEventsRoutes: FastifyPluginAsync<{
  eventsService: SessionEventsService;
  sessionService: AssessmentSessionService;
  authService?: AuthService;
}> = async (fastify, opts) => {
  const { eventsService, sessionService, authService } = opts;

  // 1. Ingest Session Telemetry Events Batch
  fastify.post("/:sessionId/events", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const parse = IngestEventsRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: "VALIDATION_FAILED",
        issues: parse.error.issues,
      });
    }

    try {
      const session = sessionService.getSession(sessionId);

      // Auth validation
      if (authService && request.headers.authorization) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, session.organizationId);

        if (auth.role === "candidate" && auth.sessionId !== sessionId) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: "Candidate token not authorized to post events to this session",
          });
        }
      }

      const result = eventsService.ingestEvents(sessionId, parse.data);
      return reply.status(201).send(result);
    } catch (err: unknown) {
      if (err instanceof SessionNotFoundError) {
        return reply.status(404).send({ error: "SESSION_NOT_FOUND", message: err.message });
      }
      if (err instanceof AuthenticationError) {
        return reply.status(401).send({ error: "UNAUTHORIZED", message: err.message });
      }
      if (err instanceof AuthorizationError || err instanceof TenantAccessDeniedError) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err.message });
      }
      const message = err instanceof Error ? err.message : "Failed to ingest session events";
      return reply.status(400).send({ error: "EVENT_INGESTION_FAILED", message });
    }
  });

  // 2. Query Session Telemetry Events (Chronological Audit Trail)
  fastify.get("/:sessionId/events", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    try {
      const session = sessionService.getSession(sessionId);

      if (authService && request.headers.authorization) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, session.organizationId);

        if (auth.role === "candidate" && auth.sessionId !== sessionId) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: "Candidate token not authorized to inspect this session's events",
          });
        }
      }

      const events = eventsService.getEvents(sessionId);
      return reply.status(200).send({
        sessionId,
        events,
        total: events.length,
      });
    } catch (err: unknown) {
      if (err instanceof SessionNotFoundError) {
        return reply.status(404).send({ error: "SESSION_NOT_FOUND", message: err.message });
      }
      if (err instanceof AuthenticationError) {
        return reply.status(401).send({ error: "UNAUTHORIZED", message: err.message });
      }
      if (err instanceof AuthorizationError || err instanceof TenantAccessDeniedError) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err.message });
      }
      throw err;
    }
  });
};
