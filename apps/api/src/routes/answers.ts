import type { FastifyPluginAsync } from "fastify";
import { AIRequestSchema } from "@ai-copilot/contracts";
import type { AIOrchestrationService } from "@ai-copilot/ai-core";

export const answersRoutes: FastifyPluginAsync<{
  orchestrator: AIOrchestrationService;
}> = async (fastify, opts) => {
  const { orchestrator } = opts;

  fastify.post("/generate", async (request, reply) => {
    const parseResult = AIRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parseResult.error.format(),
      });
    }

    try {
      const response = await orchestrator.generateAnswer(parseResult.data);
      return reply.status(200).send(response);
    } catch (err: unknown) {
      request.log.error({ err }, "Failed to generate answer");
      const message = err instanceof Error ? err.message : "Internal generation failure";
      return reply.status(502).send({
        error: "AI generation failed",
        message,
      });
    }
  });
};

