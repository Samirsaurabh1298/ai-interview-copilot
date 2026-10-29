import fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { AIOrchestrationService, MockAIProvider } from "@ai-copilot/ai-core";
import { AnthropicProvider } from "@ai-copilot/ai-provider-anthropic";
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
    timeoutMs: 35000,
  });

  // 1. Always register Mock provider for testing and fallback
  orchestrator.registerProvider(new MockAIProvider());

  // 2. Register Anthropic Claude if API key is supplied
  let anthropicProvider: AnthropicProvider | undefined;
  if (config.ANTHROPIC_API_KEY) {
    try {
      anthropicProvider = new AnthropicProvider(config.ANTHROPIC_API_KEY);
      orchestrator.registerProvider(anthropicProvider);
      app.log.info("Anthropic Claude 3.5 Sonnet provider registered.");
    } catch (err) {
      app.log.error({ err }, "Failed to initialize Anthropic provider.");
    }
  }

  // Health check
  app.get("/health", async () => ({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
    defaultProvider: config.DEFAULT_AI_PROVIDER,
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
    anthropicProvider,
  });

  await app.register(extractionRoutes, {
    prefix: "/api/v1/questions",
    anthropicProvider,
  });

  return app;
}
