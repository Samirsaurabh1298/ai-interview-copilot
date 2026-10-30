import { z } from "zod";

export const ModelCapabilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.enum(["openai", "anthropic", "google", "groq", "grok", "mock"]),
  supportsVision: z.boolean(),
  supportsStreaming: z.boolean(),
  supportsStructuredOutput: z.boolean(),
  contextWindow: z.number().int().positive(),
  costPerMillionInputTokensUsd: z.number().nonnegative(),
  costPerMillionOutputTokensUsd: z.number().nonnegative(),
  isRecommended: z.boolean().default(false),
});

export type ModelCapability = z.infer<typeof ModelCapabilitySchema>;

export const ProviderInfoSchema = z.object({
  id: z.enum(["openai", "anthropic", "google", "groq", "grok", "mock"]),
  name: z.string(),
  isConfigured: z.boolean(),
  availableModels: z.array(ModelCapabilitySchema),
});

export type ProviderInfo = z.infer<typeof ProviderInfoSchema>;

export const ProvidersResponseSchema = z.object({
  providers: z.array(ProviderInfoSchema),
  defaultProvider: z.enum(["openai", "anthropic", "google", "groq", "grok", "mock"]),
  defaultModel: z.string(),
});

export type ProvidersResponse = z.infer<typeof ProvidersResponseSchema>;

