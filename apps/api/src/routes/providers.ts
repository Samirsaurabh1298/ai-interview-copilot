import type { FastifyPluginAsync } from "fastify";
import type { AIOrchestrationService } from "@ai-copilot/ai-core";
import type { AnthropicProvider } from "@ai-copilot/ai-provider-anthropic";
import type { GoogleGeminiProvider } from "@ai-copilot/ai-provider-google";
import type { OpenAIProvider } from "@ai-copilot/ai-provider-openai";
import type { GroqProvider } from "@ai-copilot/ai-provider-groq";
import type { AppConfig } from "../config.js";

export const providersRoutes: FastifyPluginAsync<{
  orchestrator: AIOrchestrationService;
  config: AppConfig;
  anthropicProvider?: AnthropicProvider | undefined;
  googleProvider?: GoogleGeminiProvider | undefined;
  openaiProvider?: OpenAIProvider | undefined;
  groqProvider?: GroqProvider | undefined;
}> = async (fastify, opts) => {
  const { orchestrator, config, anthropicProvider, googleProvider, openaiProvider, groqProvider } = opts;

  fastify.get("/", async (_request, reply) => {
    const mockProvider = orchestrator.getProvider("mock");
    const mockCaps = await mockProvider.getCapabilities();

    const groqCaps = groqProvider
      ? await groqProvider.getCapabilities()
      : [];

    const anthropicCaps = anthropicProvider
      ? await anthropicProvider.getCapabilities()
      : [];

    const googleCaps = googleProvider
      ? await googleProvider.getCapabilities()
      : [];

    const openaiCaps = openaiProvider
      ? await openaiProvider.getCapabilities()
      : [];

    return reply.status(200).send({
      providers: [
        {
          id: "groq",
          name: "Groq LPU (Ultra-Fast)",
          isConfigured: Boolean(groqProvider),
          availableModels: groqCaps,
        },
        {
          id: "anthropic",
          name: "Anthropic Claude 3.5 Sonnet",
          isConfigured: Boolean(anthropicProvider),
          availableModels: anthropicCaps,
        },
        {
          id: "google",
          name: "Google Gemini 2.0 Flash",
          isConfigured: Boolean(googleProvider),
          availableModels: googleCaps,
        },
        {
          id: "openai",
          name: "OpenAI GPT-4o",
          isConfigured: Boolean(openaiProvider),
          availableModels: openaiCaps,
        },
        {
          id: "mock",
          name: "Mock Deterministic Provider",
          isConfigured: true,
          availableModels: mockCaps,
        },
      ],
      defaultProvider: config.DEFAULT_AI_PROVIDER,
      defaultModel: config.DEFAULT_AI_MODEL,
    });
  });
};
