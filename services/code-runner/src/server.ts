import fastify from "fastify";
import cors from "@fastify/cors";
import { CodeValidationRequestSchema } from "@ai-copilot/contracts";
import { executeCodeInSandbox } from "./runner.js";
import { OciGvisorExecutionProvider } from "./providers/oci-gvisor.js";

export async function buildRunnerServer() {
  const ociProvider = new OciGvisorExecutionProvider();

  const app = fastify({
    logger: {
      level: "info",
    },
  });

  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
  });

  app.get("/health", async () => ({
    status: "healthy",
    service: "code-runner",
    timestamp: new Date().toISOString(),
  }));

  app.get("/environment", async () => {
    return ociProvider.getEnvironmentInfo();
  });

  app.post("/validate", async (request, reply) => {
    const parseResult = CodeValidationRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parseResult.error.format(),
      });
    }

    try {
      const result = await executeCodeInSandbox(parseResult.data);
      return reply.status(200).send(result);
    } catch (err: unknown) {
      request.log.error({ err }, "Sandbox execution error");
      return reply.status(500).send({
        error: "Execution failed",
        message: err instanceof Error ? err.message : "Internal sandbox failure",
      });
    }
  });

  return app;
}

if (process.env.NODE_ENV !== "test" && process.env.RUNNER_STANDALONE === "true") {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4100;
  buildRunnerServer().then((app) => {
    app.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      console.log(`Code Runner Sandbox listening at ${address}`);
    });
  });
}

