import fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { AIOrchestrationService, MockAIProvider } from "@ai-copilot/ai-core";
import { AnthropicProvider } from "@ai-copilot/ai-provider-anthropic";
import { GoogleGeminiProvider } from "@ai-copilot/ai-provider-google";
import { OpenAIProvider } from "@ai-copilot/ai-provider-openai";
import { GroqProvider } from "@ai-copilot/ai-provider-groq";
import { answersRoutes } from "./routes/answers.js";
import { providersRoutes } from "./routes/providers.js";
import { extractionRoutes } from "./routes/extraction.js";
import { validationRoutes } from "./routes/validation.js";
import { contextRoutes } from "./routes/context.js";
import { usageRoutes } from "./routes/usage.js";
import { assessmentRoutes } from "./routes/assessment.js";
import { organizationsRoutes } from "./routes/organizations.js";
import { UsageLedgerService } from "./services/ledger.js";
import { AIUsageGatewayService } from "./services/gateway.js";
import { OrganizationService } from "./services/organization.js";
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
    defaultProviderId: config.DEFAULT_AI_PROVIDER,
    maxRetries: 2,
    timeoutMs: 35000,
  });

  // Always register deterministic Mock provider
  orchestrator.registerProvider(new MockAIProvider());

  // 1. Anthropic Claude 3.5 Sonnet
  let anthropicProvider: AnthropicProvider | undefined;
  if (config.ANTHROPIC_API_KEY) {
    try {
      anthropicProvider = new AnthropicProvider(config.ANTHROPIC_API_KEY);
      orchestrator.registerProvider(anthropicProvider);
      app.log.info("Anthropic Claude provider registered.");
    } catch (err) {
      app.log.error({ err }, "Failed to initialize Anthropic provider.");
    }
  }

  // 2. Google Gemini 2.0 Flash
  let googleProvider: GoogleGeminiProvider | undefined;
  if (config.GOOGLE_GENERATIVE_AI_API_KEY) {
    try {
      googleProvider = new GoogleGeminiProvider(config.GOOGLE_GENERATIVE_AI_API_KEY);
      orchestrator.registerProvider(googleProvider);
      app.log.info("Google Gemini provider registered.");
    } catch (err) {
      app.log.error({ err }, "Failed to initialize Google Gemini provider.");
    }
  }

  // 3. OpenAI GPT-4o
  let openaiProvider: OpenAIProvider | undefined;
  if (config.OPENAI_API_KEY) {
    try {
      openaiProvider = new OpenAIProvider(config.OPENAI_API_KEY);
      orchestrator.registerProvider(openaiProvider);
      app.log.info("OpenAI provider registered.");
    } catch (err) {
      app.log.error({ err }, "Failed to initialize OpenAI provider.");
    }
  }

  // 4. Groq LPU (Ultra-Fast)
  let groqProvider: GroqProvider | undefined;
  if (config.GROQ_API_KEY) {
    try {
      groqProvider = new GroqProvider(config.GROQ_API_KEY);
      orchestrator.registerProvider(groqProvider);
      // Register 'grok' alias for seamless user compatibility
      orchestrator.registerProvider({
        id: "grok",
        name: "Groq LPU (Ultra-Fast)",
        defaultModel: groqProvider.defaultModel,
        getCapabilities: () => groqProvider!.getCapabilities(),
        generate: (req, override) => groqProvider!.generate(req, override),
      });
      app.log.info("Groq LPU provider registered with grok alias.");
    } catch (err) {
      app.log.error({ err }, "Failed to initialize Groq provider.");
    }
  }

  // Health check
  app.get("/health", async () => ({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
    defaultProvider: config.DEFAULT_AI_PROVIDER,
  }));

  const ledger = new UsageLedgerService();
  const gateway = new AIUsageGatewayService();
  const orgService = new OrganizationService();

  // Route registration
  await app.register(organizationsRoutes, {
    prefix: "/api/v1/organizations",
    orgService,
  });

  await app.register(answersRoutes, {
    prefix: "/api/v1/answers",
    orchestrator,
    gateway,
  });

  await app.register(providersRoutes, {
    prefix: "/api/v1/providers",
    orchestrator,
    config,
    anthropicProvider,
    googleProvider,
    openaiProvider,
    groqProvider,
  });

  await app.register(extractionRoutes, {
    prefix: "/api/v1/questions",
    anthropicProvider,
    googleProvider,
    openaiProvider,
  });

  await app.register(validationRoutes, {
    prefix: "/api/v1/code",
  });

  await app.register(contextRoutes, {
    prefix: "/api/v1/context",
  });

  await app.register(usageRoutes, {
    prefix: "/api/v1/usage",
    ledger,
  });

  await app.register(assessmentRoutes, {
    prefix: "/api/v1/assessment",
    gateway,
    ledger,
  });

  return app;
}
