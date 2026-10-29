import type { FastifyPluginAsync } from "fastify";
import type { AIOrchestrationService } from "@ai-copilot/ai-core";
import type { AnthropicProvider } from "@ai-copilot/ai-provider-anthropic";
import type { AppConfig } from "../config.js";

export const providersRoutes: FastifyPluginAsync<{
  orchestrator: AIOrchestrationService;
  config: AppConfig;
  anthropicProvider?: AnthropicProvider | undefined;
}> = async (fastify, opts) => {
  const { orchestrator, config, anthropicProvider } = opts;

  fastify.get("/", async (_request, reply) => {
    const mockProvider = orchestrator.getProvider("mock");
    const mockCaps = await mockProvider.getCapabilities();

    const anthropicCaps = anthropicProvider
      ? await anthropicProvider.getCapabilities()
      : [];

    return reply.status(200).send({
      providers: [
        {
          id: "anthropic",
          name: "Anthropic Claude",
          isConfigured: Boolean(anthropicProvider),
          availableModels: anthropicCaps,
        },
        {
          id: "mock",
          name: "Mock Deterministic Provider",
          isConfigured: true,
          availableModels: mockCaps,
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
