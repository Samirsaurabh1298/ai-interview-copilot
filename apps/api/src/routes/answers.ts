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

    try {
      if (gateway && query?.sessionId) {
        gateway.assertCanInvokeAI(query.sessionId);
      }

      const response = await orchestrator.generateAnswer(parseResult.data, {
        providerId: query?.provider,
        modelOverride: query?.model,
      });

      if (gateway && query?.sessionId) {
        gateway.recordUsage(
          query.sessionId,
          response.model || "default",
          response.usage?.inputTokens ?? 250,
          response.usage?.outputTokens ?? 350
        );
      }

      return reply.status(200).send(response);
    } catch (err: unknown) {
      if (err instanceof AIProviderError && err.code === "QUOTA_EXHAUSTED") {
        return reply.status(429).send({
          error: "QUOTA_EXHAUSTED",
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

