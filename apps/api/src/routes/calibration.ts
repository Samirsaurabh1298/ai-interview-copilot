import type { FastifyPluginAsync } from "fastify";
import {
  SubmitReviewerEvaluationRequestSchema,
} from "@ai-copilot/contracts";
import type { CalibrationService } from "../services/calibration.js";
import type { AuthService } from "../services/auth.js";
import {
  TenantAccessDeniedError,
  AuthorizationError,
  isTenantOrAuthForbiddenError,
} from "../services/auth.js";
import type { AssessmentSessionService } from "../services/session.js";
import { SessionNotFoundError } from "../services/session.js";

export const calibrationRoutes: FastifyPluginAsync<{
  calibrationService: CalibrationService;
  authService?: AuthService;
  sessionService?: AssessmentSessionService;
}> = async (fastify, opts) => {
  const { calibrationService, authService, sessionService } = opts;

  // 1. Submit or update Reviewer Evaluation (Blind Scoring)
  fastify.post("/:sessionId/evaluations", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    const parse = SubmitReviewerEvaluationRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: "VALIDATION_FAILED",
        message: "Invalid reviewer evaluation payload",
        issues: parse.error.issues,
      });
    }

    if (!authService || !request.headers.authorization) {
      return reply.status(401).send({
        error: "UNAUTHORIZED",
        message: "Authentication header required to evaluate submissions",
      });
    }

    try {
      const auth = authService.parseAuthHeader(request.headers.authorization);
      if (!["owner", "admin", "interviewer", "reviewer"].includes(auth.role)) {
        return reply.status(403).send({
          error: "FORBIDDEN",
          message: `Role '${auth.role}' is not authorized to submit evaluations`,
        });
      }

      if (sessionService) {
        const session = sessionService.getSession(sessionId);
        authService.assertTenantAccess(auth, session.organizationId);
      }

      const evaluation = await calibrationService.submitEvaluation(sessionId, auth, parse.data);
      return reply.status(201).send(evaluation);
    } catch (err: unknown) {
      if (isTenantOrAuthForbiddenError(err)) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err instanceof Error ? err.message : "Forbidden" });
      }
      if (err instanceof SessionNotFoundError || (err instanceof Error && err.name === "SessionNotFoundError")) {
        return reply.status(404).send({ error: "SESSION_NOT_FOUND", message: err instanceof Error ? err.message : "Session not found" });
      }
      const message = err instanceof Error ? err.message : "Failed to submit evaluation";
      return reply.status(400).send({ error: "EVALUATION_SUBMISSION_FAILED", message });
    }
  });

  // 2. Get All Evaluations for a Session (Enforces Blind Reviewer Masking)
  fastify.get("/:sessionId/evaluations", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    try {
      let requestingUser = undefined;
      if (authService && request.headers.authorization) {
        requestingUser = authService.parseAuthHeader(request.headers.authorization);
        authService.assertCompanyMember(requestingUser);
        if (sessionService) {
          const session = sessionService.getSession(sessionId);
          authService.assertTenantAccess(requestingUser, session.organizationId);
        }
      }

      const result = await calibrationService.getEvaluations(sessionId, requestingUser);
      return reply.status(200).send(result);
    } catch (err: unknown) {
      if (isTenantOrAuthForbiddenError(err)) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err instanceof Error ? err.message : "Forbidden" });
      }
      if (err instanceof SessionNotFoundError || (err instanceof Error && err.name === "SessionNotFoundError")) {
        return reply.status(404).send({ error: "SESSION_NOT_FOUND", message: err instanceof Error ? err.message : "Session not found" });
      }
      const message = err instanceof Error ? err.message : "Failed to fetch evaluations";
      return reply.status(400).send({ error: "FETCH_EVALUATIONS_FAILED", message });
    }
  });

  // 3. Get Calibration Consensus & Variance Analysis
  fastify.get("/:sessionId/calibration", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    try {
      let requestingUser = undefined;
      if (authService && request.headers.authorization) {
        requestingUser = authService.parseAuthHeader(request.headers.authorization);
        authService.assertCompanyMember(requestingUser);
        if (sessionService) {
          const session = sessionService.getSession(sessionId);
          authService.assertTenantAccess(requestingUser, session.organizationId);
        }
      }

      const consensus = await calibrationService.getCalibrationConsensus(sessionId, requestingUser);
      return reply.status(200).send(consensus);
    } catch (err: unknown) {
      if (isTenantOrAuthForbiddenError(err)) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err instanceof Error ? err.message : "Forbidden" });
      }
      if (err instanceof SessionNotFoundError || (err instanceof Error && err.name === "SessionNotFoundError")) {
        return reply.status(404).send({ error: "SESSION_NOT_FOUND", message: err instanceof Error ? err.message : "Session not found" });
      }
      const message = err instanceof Error ? err.message : "Failed to compute calibration consensus";
      return reply.status(400).send({ error: "CALIBRATION_FAILED", message });
    }
  });

  // 4. Generate AI Draft Baseline Scorecard (Reference Anchor for Reviewers)
  fastify.get("/:sessionId/scorecard/ai-draft", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    try {
      if (authService && request.headers.authorization) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        if (sessionService) {
          const session = sessionService.getSession(sessionId);
          authService.assertTenantAccess(auth, session.organizationId);
        }
      }

      const draftScorecard = await calibrationService.generateAiDraftScorecard(sessionId);
      return reply.status(200).send(draftScorecard);
    } catch (err: unknown) {
      if (isTenantOrAuthForbiddenError(err)) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err instanceof Error ? err.message : "Forbidden" });
      }
      if (err instanceof SessionNotFoundError || (err instanceof Error && err.name === "SessionNotFoundError")) {
        return reply.status(404).send({ error: "SESSION_NOT_FOUND", message: err instanceof Error ? err.message : "Session not found" });
      }
      const message = err instanceof Error ? err.message : "Failed to generate AI draft scorecard";
      return reply.status(400).send({ error: "AI_DRAFT_FAILED", message });
    }
  });
};

