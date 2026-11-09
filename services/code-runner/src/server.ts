import fastify, { FastifyRequest, FastifyReply } from "fastify";
import cors from "@fastify/cors";
import { CodeValidationRequestSchema } from "@ai-copilot/contracts";
import { executeCodeInSandbox } from "./runner.js";
import { OciGvisorExecutionProvider } from "./providers/oci-gvisor.js";

export interface RunnerServerOptions {
  authToken?: string | undefined;
  allowUnauthenticated?: boolean | undefined;
}

export async function buildRunnerServer(options?: RunnerServerOptions) {
  const ociProvider = new OciGvisorExecutionProvider();
  const configuredSecret =
    options?.authToken ??
    process.env.CODE_RUNNER_SECRET ??
    process.env.CODE_RUNNER_AUTH_TOKEN;
  const allowUnauth =
    options?.allowUnauthenticated ??
    (!configuredSecret && process.env.NODE_ENV === "test");

  const app = fastify({
    logger: {
      level: process.env.NODE_ENV === "test" ? "silent" : "info",
    },
  });

  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
  });

  const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    if (allowUnauth && !configuredSecret) {
      return;
    }
    const authHeader = request.headers.authorization;
    const runnerHeader = request.headers["x-runner-token"];
    const bearer = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : undefined;
    const token =
      bearer || (typeof runnerHeader === "string" ? runnerHeader : undefined);

    if (!token || (configuredSecret && token !== configuredSecret)) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Invalid or missing runner authentication token",
      });
    }
  };

  app.get("/health", async () => ({
    status: "healthy",
    service: "code-runner",
    timestamp: new Date().toISOString(),
  }));

  app.get("/environment", { preHandler: authenticate }, async () => {
    return ociProvider.getEnvironmentInfo();
  });

  app.post("/validate", { preHandler: authenticate }, async (request, reply) => {
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

