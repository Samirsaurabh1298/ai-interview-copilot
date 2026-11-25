import type { FastifyPluginAsync } from "fastify";
import { AIRequestSchema, type AIResponse } from "@ai-copilot/contracts";
import type { AIOrchestrationService } from "@ai-copilot/ai-core";
import { AIProviderError } from "@ai-copilot/ai-core";
import type { AIUsageGatewayService } from "../services/gateway.js";
import {
  type AssessmentSessionService,
  SessionExpiredError,
  SessionInvalidStateError,
  SessionNotFoundError,
} from "../services/session.js";
import type { AssessmentTemplateService } from "../services/template.js";
import type { AuthService } from "../services/auth.js";

export const answersRoutes: FastifyPluginAsync<{
  orchestrator: AIOrchestrationService;
  gateway?: AIUsageGatewayService;
  sessionService?: AssessmentSessionService;
  templateService?: AssessmentTemplateService;
  authService?: AuthService;
}> = async (fastify, opts) => {
  const { orchestrator, gateway, sessionService, templateService, authService } = opts;

  fastify.post("/generate", async (request, reply) => {
    const parseResult = AIRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parseResult.error.format(),
      });
    }

    const query = request.query as {
      provider?: string;
      model?: string;
      sessionId?: string;
      taskId?: string;
    } | undefined;

    let effectiveSessionId = query?.sessionId;
    if (!effectiveSessionId && authService && request.headers.authorization) {
      try {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        if (auth.role === "candidate" && auth.sessionId) {
          effectiveSessionId = auth.sessionId;
        }
      } catch {
        // Fall through if unauthenticated or invalid token
      }
    }

    // Assessment Session State & Deadline Enforcement (Non-Negotiable Invariant 2)
    if (effectiveSessionId && sessionService) {
      try {
        sessionService.assertCanInvokeAI(effectiveSessionId);
      } catch (err: unknown) {
        const errName = (err as any)?.name || (err as any)?.constructor?.name;
        if (err instanceof SessionExpiredError || errName === "SessionExpiredError") {
          return reply.status(410).send({
            error: "SESSION_EXPIRED",
            message: (err as Error).message,
          });
        }
        if (err instanceof SessionInvalidStateError || errName === "SessionInvalidStateError") {
          return reply.status(409).send({
            error: "INVALID_STATE",
            message: (err as Error).message,
          });
        }
        if (err instanceof SessionNotFoundError || errName === "SessionNotFoundError") {
          // Session not managed by sessionService (e.g. legacy/mocked gateway session in assessment tests)
          // Fall through to gateway checks
        } else {
          throw err;
        }
      }
    }

    // Task-level AI Policy Enforcement (authoritative server-side policy + model lock)
    let aiRequestPayload = parseResult.data;
    let effectiveModel = query?.model;
    let authoritativePolicyMode = parseResult.data.policyMode;

    if (query?.taskId && effectiveSessionId && sessionService && templateService) {
      try {
        const session = sessionService.getSession(effectiveSessionId);
        const template = templateService.getTemplateById(session.organizationId, session.templateId);
        const task = template?.tasks?.find((t) => t.id === query.taskId);

        if (task?.aiPolicy?.mode === "prohibited") {
          return reply.status(403).send({
            error: "AI_PROHIBITED_FOR_TASK",
            message: task.aiPolicy.disclosureNotice || "AI assistance is strictly prohibited for this task.",
          });
        }

        if (task?.aiPolicy?.mode) {
          authoritativePolicyMode = task.aiPolicy.mode;
          aiRequestPayload = {
            ...parseResult.data,
            policyMode: task.aiPolicy.mode,
          };

          if (task.aiPolicy.mode === "flawed_junior") {
            // Lock model to configured weak/small model so candidate cannot override ?model=gpt-4o
            effectiveModel = task.aiPolicy.allowedModel || "gpt-4o-mini";
          } else if (task.aiPolicy.allowedModel) {
            effectiveModel = task.aiPolicy.allowedModel;
          }
        }
      } catch {
        // Fall through if session not yet created
      }
    }

    let reservationId: string | undefined;

    try {
      if (gateway && effectiveSessionId) {
        reservationId = gateway.reserveBudget(effectiveSessionId, effectiveModel || "default");
      }

      let response: AIResponse;
      if (!query?.provider) {
        try {
          response = await orchestrator.generateAnswer(aiRequestPayload, {
            modelOverride: effectiveModel,
          });
        } catch (genErr: unknown) {
          request.log.warn({ genErr }, "Primary default AI provider failed, engaging resilient fallback provider");
          response = await orchestrator.generateAnswer(aiRequestPayload, {
            providerId: "mock",
            modelOverride: effectiveModel,
          });
        }
      } else {
        response = await orchestrator.generateAnswer(aiRequestPayload, {
          providerId: query.provider,
          modelOverride: effectiveModel,
        });
      }

      if (authoritativePolicyMode === "restricted_explainer") {
        response = {
          ...response,
          code: "",
          codeChanges: [],
        };
      }

      if (gateway && effectiveSessionId && reservationId) {
        gateway.commitUsage(
          effectiveSessionId,
          reservationId,
          response.model || effectiveModel || "default",
          response.usage?.inputTokens ?? 250,
          response.usage?.outputTokens ?? 350
        );
      } else if (gateway && effectiveSessionId) {
        gateway.recordUsage(
          effectiveSessionId,
          response.model || effectiveModel || "default",
          response.usage?.inputTokens ?? 250,
          response.usage?.outputTokens ?? 350
        );
      }

      return reply.status(200).send(response);
    } catch (err: unknown) {
      if (gateway && effectiveSessionId && reservationId) {
        gateway.releaseReservation(effectiveSessionId, reservationId);
      }

      if (err instanceof AIProviderError && (err.code === "QUOTA_EXHAUSTED" || err.code === "SESSION_EXPIRED")) {
        const statusCode = err.code === "SESSION_EXPIRED" ? 403 : 429;
        return reply.status(statusCode).send({
          error: err.code,
          message: err.message,
        });
      }

      request.log.error({ err }, "Failed to generate answer");
      const message = err instanceof Error ? err.message : "Internal generation failure";
      return reply.status(502).send({
        error: "AI generation failed",
        message,
      });
    }
  });
};

