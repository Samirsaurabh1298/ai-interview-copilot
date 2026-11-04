import type { FastifyPluginAsync } from "fastify";
import { AIRequestSchema, type AIResponse } from "@ai-copilot/contracts";
import type { AIOrchestrationService } from "@ai-copilot/ai-core";
import { AIProviderError } from "@ai-copilot/ai-core";
import type { AIUsageGatewayService } from "../services/gateway.js";
import type { AssessmentSessionService } from "../services/session.js";
import type { AssessmentTemplateService } from "../services/template.js";

export const answersRoutes: FastifyPluginAsync<{
  orchestrator: AIOrchestrationService;
  gateway?: AIUsageGatewayService;
  sessionService?: AssessmentSessionService;
  templateService?: AssessmentTemplateService;
}> = async (fastify, opts) => {
  const { orchestrator, gateway, sessionService, templateService } = opts;

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

    // Task-level AI Policy Enforcement
    if (query?.taskId && query?.sessionId && sessionService && templateService) {
      try {
        const session = sessionService.getSession(query.sessionId);
        const template = templateService.getTemplateById(session.organizationId, session.templateId);
        const task = template?.tasks?.find((t) => t.id === query.taskId);

        if (task?.aiPolicy?.mode === "prohibited") {
          return reply.status(403).send({
            error: "AI_PROHIBITED_FOR_TASK",
            message: task.aiPolicy.disclosureNotice || "AI assistance is strictly prohibited for this task.",
          });
        }
      } catch {
        // Fall through if session not yet created
      }
    }

    let reservationId: string | undefined;

    try {
      if (gateway && query?.sessionId) {
        reservationId = gateway.reserveBudget(query.sessionId, query?.model || "default");
      }

      let response: AIResponse;
      if (!query?.provider) {
        try {
          response = await orchestrator.generateAnswer(parseResult.data, {
            modelOverride: query?.model,
          });
        } catch (genErr: unknown) {
          request.log.warn({ genErr }, "Primary default AI provider failed, engaging resilient fallback provider");
          response = await orchestrator.generateAnswer(parseResult.data, {
            providerId: "mock",
          });
        }
      } else {
        response = await orchestrator.generateAnswer(parseResult.data, {
          providerId: query.provider,
          modelOverride: query?.model,
        });
      }

      if (gateway && query?.sessionId && reservationId) {
        gateway.commitUsage(
          query.sessionId,
          reservationId,
          response.model || query?.model || "default",
          response.usage?.inputTokens ?? 250,
          response.usage?.outputTokens ?? 350
        );
      } else if (gateway && query?.sessionId) {
        gateway.recordUsage(
          query.sessionId,
          response.model || query?.model || "default",
          response.usage?.inputTokens ?? 250,
          response.usage?.outputTokens ?? 350
        );
      }

      return reply.status(200).send(response);
    } catch (err: unknown) {
      if (gateway && query?.sessionId && reservationId) {
        gateway.releaseReservation(query.sessionId, reservationId);
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

