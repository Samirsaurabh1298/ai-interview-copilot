import type { FastifyPluginAsync } from "fastify";
import type { AIOrchestrationService } from "@ai-copilot/ai-core";
import type { AppConfig } from "../config.js";

export const providersRoutes: FastifyPluginAsync<{
  orchestrator: AIOrchestrationService;
  config: AppConfig;
}> = async (fastify, opts) => {
  const { orchestrator, config } = opts;

  fastify.get("/", async (_request, reply) => {
    const mockProvider = orchestrator.getProvider("mock");
    const mockCaps = await mockProvider.getCapabilities();

    return reply.status(200).send({
      providers: [
        {
          id: "mock",
          name: "Mock Provider (Development / Offline)",
          isConfigured: true,
          availableModels: mockCaps,
        },
        {
          id: "anthropic",
          name: "Anthropic Claude",
          isConfigured: Boolean(config.ANTHROPIC_API_KEY),
          availableModels: [],
        },
        {
          id: "openai",
          name: "OpenAI GPT",
          isConfigured: Boolean(config.OPENAI_API_KEY),
          availableModels: [],
        },
        {
          id: "google",
          name: "Google Gemini",
          isConfigured: Boolean(config.GOOGLE_GENERATIVE_AI_API_KEY),
          availableModels: [],
        },
      ],
      defaultProvider: config.DEFAULT_AI_PROVIDER,
      defaultModel: config.DEFAULT_AI_MODEL,
    });
  });
};

