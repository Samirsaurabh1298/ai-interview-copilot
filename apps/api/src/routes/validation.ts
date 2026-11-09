import type { FastifyPluginAsync } from "fastify";
import {
  CodeValidationRequestSchema,
  type CodeValidationResponse,
} from "@ai-copilot/contracts";
import { CodeRunnerClient } from "@ai-copilot/code-runner";
import type { AppConfig } from "../config.js";

export const validationRoutes: FastifyPluginAsync<{
  config?: AppConfig;
}> = async (fastify, opts) => {
  const runnerClient = new CodeRunnerClient();
  const executionEnabled =
    opts.config?.RUNNER_EXECUTION_ENABLED ?? (process.env.NODE_ENV === "test");

  fastify.get("/validate/status", async () => {
    return {
      executionEnabled,
      runtime: executionEnabled ? "gvisor_isolated" : "disabled",
      message: executionEnabled
        ? "Isolated execution engine is active."
        : "Untrusted candidate code execution is disabled pending verified Linux gVisor deployment.",
    };
  });

  fastify.post("/validate", async (request, reply) => {
    const parseResult = CodeValidationRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parseResult.error.format(),
      });
    }

    // Critical Security Gate (LOOP 10): Reject execution when gate is closed
    if (!executionEnabled) {
      return reply.status(403).send({
        error: "RUNNER_EXECUTION_DISABLED",
        message:
          "Untrusted candidate code execution is disabled pending verified isolated Linux gVisor worker deployment. Submissions are preserved for code review, comprehension, and reviewer rubric scoring.",
        securityGate: "RUNNER_EXECUTION_DISABLED",
        canSubmit: true,
      });
    }

    try {
      const response: CodeValidationResponse = await runnerClient.execute(parseResult.data);
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

