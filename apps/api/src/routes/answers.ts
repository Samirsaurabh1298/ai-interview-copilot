import type { FastifyPluginAsync } from "fastify";
import { AIRequestSchema } from "@ai-copilot/contracts";
import type { AIOrchestrationService } from "@ai-copilot/ai-core";
import { AIProviderError } from "@ai-copilot/ai-core";
import type { AIUsageGatewayService } from "../services/gateway.js";

export const answersRoutes: FastifyPluginAsync<{
  orchestrator: AIOrchestrationService;
  gateway?: AIUsageGatewayService;
}> = async (fastify, opts) => {
  const { orchestrator, gateway } = opts;

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
    } | undefined;

    let reservationId: string | undefined;

    try {
      if (gateway && query?.sessionId) {
        reservationId = gateway.reserveBudget(query.sessionId, query?.model || "default");
      }

      const response = await orchestrator.generateAnswer(parseResult.data, {
        providerId: query?.provider,
        modelOverride: query?.model,
      });

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

