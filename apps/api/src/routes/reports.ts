import type { FastifyPluginAsync } from "fastify";
import type { ReportService } from "../services/report.js";
import type { AuthService } from "../services/auth.js";
import {
  TenantAccessDeniedError,
  AuthorizationError,
  isTenantOrAuthForbiddenError,
} from "../services/auth.js";
import type { AssessmentSessionService } from "../services/session.js";

export const reportsRoutes: FastifyPluginAsync<{
  reportService: ReportService;
  authService?: AuthService;
  sessionService?: AssessmentSessionService;
}> = async (fastify, opts) => {
  const { reportService, authService, sessionService } = opts;

  // 1. Get Typed Hiring Decision Report (JSON format for ATS/HRIS integration)
  fastify.get("/:sessionId/report", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    if (authService && request.headers.authorization) {
      try {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        if (sessionService) {
          const session = sessionService.getSession(sessionId);
          if (auth.role === "candidate") {
            if (auth.sessionId !== sessionId) {
              return reply.status(403).send({ error: "FORBIDDEN", message: "Candidate cannot access reports of another session" });
            }
          } else {
            authService.assertTenantAccess(auth, session.organizationId);
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && (err.name === "SessionNotFoundError" || err.message.includes("not found"))) {
          return reply.status(404).send({ error: "NOT_FOUND", message: err.message });
        }
        if (isTenantOrAuthForbiddenError(err)) {
          return reply.status(403).send({ error: "FORBIDDEN", message: err instanceof Error ? err.message : "Forbidden" });
        }
        return reply.status(401).send({
          error: "UNAUTHORIZED",
          message: err instanceof Error ? err.message : "Authentication failed",
        });
      }
    }

    try {
      const report = await reportService.generateHiringReport(sessionId);
      return reply.status(200).send(report);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate hiring report";
      if (msg.includes("not found")) {
        return reply.status(404).send({ error: "NOT_FOUND", message: msg });
      }
      return reply.status(500).send({ error: "REPORT_GENERATION_FAILED", message: msg });
    }
  });

  // 2. Export Standalone Print-Ready HTML Hiring Decision Report (PDF / Print view)
  fastify.get("/:sessionId/report/export", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const query = request.query as { token?: string };

    // Support query token or header authorization
    const tokenHeader = request.headers.authorization || (query.token ? `Bearer ${query.token}` : undefined);
    if (authService && tokenHeader) {
      try {
        const auth = authService.parseAuthHeader(tokenHeader);
        if (sessionService) {
          const session = sessionService.getSession(sessionId);
          if (auth.role === "candidate") {
            if (auth.sessionId !== sessionId) {
              return reply.status(403).send({ error: "FORBIDDEN", message: "Candidate cannot export reports of another session" });
            }
          } else {
            authService.assertTenantAccess(auth, session.organizationId);
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && (err.name === "SessionNotFoundError" || err.message.includes("not found"))) {
          return reply.status(404).send({ error: "NOT_FOUND", message: err.message });
        }
        if (isTenantOrAuthForbiddenError(err)) {
          return reply.status(403).send({ error: "FORBIDDEN", message: err instanceof Error ? err.message : "Forbidden" });
        }
        return reply.status(401).send({
          error: "UNAUTHORIZED",
          message: err instanceof Error ? err.message : "Authentication failed",
        });
      }
    }

    try {
      const report = await reportService.generateHiringReport(sessionId);
      const html = reportService.exportReportHtml(report);
      return reply
        .status(200)
        .header("Content-Type", "text/html; charset=utf-8")
        .send(html);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to export hiring report";
      if (msg.includes("not found")) {
        return reply.status(404).send({ error: "NOT_FOUND", message: msg });
      }
      return reply.status(500).send({ error: "EXPORT_FAILED", message: msg });
    }
  });
};
