import fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { AIOrchestrationService, MockAIProvider } from "@ai-copilot/ai-core";
import { answersRoutes } from "./routes/answers.js";
import { providersRoutes } from "./routes/providers.js";
import { extractionRoutes } from "./routes/extraction.js";
import type { AppConfig } from "./config.js";

export async function buildApp(config: AppConfig): Promise<FastifyInstance> {
  const app = fastify({
    logger:
      config.NODE_ENV === "test"
        ? false
        : {
            level: config.NODE_ENV === "production" ? "info" : "debug",
            redact: ["req.headers.authorization", "*.apiKey", "*.token"],
          },
  });

  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });

  // Initialize Orchestration Engine
  const orchestrator = new AIOrchestrationService({
    defaultProviderId: config.DEFAULT_AI_PROVIDER as "openai" | "anthropic" | "google" | "mock",
    maxRetries: 2,
    timeoutMs: 30000,
  });

  // Register providers (Mock provider is always registered for local testing)
  orchestrator.registerProvider(new MockAIProvider());

  // Health check
  app.get("/health", async () => ({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  }));

  // Route registration
  await app.register(answersRoutes, {
    prefix: "/api/v1/answers",
    orchestrator,
  });

  await app.register(providersRoutes, {
    prefix: "/api/v1/providers",
    orchestrator,
    config,
  });

  await app.register(extractionRoutes, {
    prefix: "/api/v1/questions",
  });

  return app;
}

