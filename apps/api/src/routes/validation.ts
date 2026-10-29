import type { FastifyPluginAsync } from "fastify";
import {
  CodeValidationRequestSchema,
  type CodeValidationResponse,
} from "@ai-copilot/contracts";
import { executeCodeInSandbox } from "@ai-copilot/code-runner";

export const validationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/validate", async (request, reply) => {
    const parseResult = CodeValidationRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parseResult.error.format(),
      });
    }

    try {
      const response: CodeValidationResponse = await executeCodeInSandbox(parseResult.data);
      return reply.status(200).send(response);
    } catch (err: unknown) {
      request.log.error({ err }, "Sandbox execution error");
      return reply.status(500).send({
        error: "Sandbox error",
        message: err instanceof Error ? err.message : "Internal sandbox runner error",
      });
    }
  });
};

