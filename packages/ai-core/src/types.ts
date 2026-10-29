import type { AIRequest, AIResponse, ModelCapability } from "@ai-copilot/contracts";

export interface AIProvider {
  readonly id: "openai" | "anthropic" | "google" | "mock";
  readonly name: string;
  readonly defaultModel: string;
  getCapabilities(): Promise<ModelCapability[]>;
  generate(request: AIRequest, modelOverride?: string): Promise<AIResponse>;
}

export interface OrchestratorOptions {
  defaultProviderId?: "openai" | "anthropic" | "google" | "mock";
  maxRetries?: number;
  timeoutMs?: number;
}

