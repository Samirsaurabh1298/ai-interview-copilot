import { GoogleGenAI } from "@google/genai";
import type {
  AIRequest,
  AIResponse,
  ModelCapability,
} from "@ai-copilot/contracts";
import { InterviewAnswerSchema } from "@ai-copilot/contracts";
import type { AIProvider } from "@ai-copilot/ai-core";
import {
  AIProviderError,
  SYSTEM_INTERVIEW_COPILOT_PROMPT,
  buildPromptForRequest,
} from "@ai-copilot/ai-core";

const GEMINI_FLASH_MODEL = "gemini-2.0-flash";

export class GoogleGeminiProvider implements AIProvider {
  public readonly id = "google" as const;
  public readonly name = "Google Gemini 2.0 Flash";
  public readonly defaultModel = GEMINI_FLASH_MODEL;

  private client: GoogleGenAI;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key) {
      throw new AIProviderError({
        message: "GOOGLE_GENERATIVE_AI_API_KEY is not configured.",
        code: "AUTHENTICATION_FAILED",
        provider: this.id,
        isRetryable: false,
      });
    }

    this.client = new GoogleGenAI({ apiKey: key });
  }

  public async getCapabilities(): Promise<ModelCapability[]> {
    return [
      {
        id: GEMINI_FLASH_MODEL,
        name: "Gemini 2.0 Flash",
        provider: "google",
        supportsVision: true,
        supportsStreaming: true,
        supportsStructuredOutput: true,
        contextWindow: 1048576, // 1M tokens
        costPerMillionInputTokensUsd: 0.1,
        costPerMillionOutputTokensUsd: 0.4,
        isRecommended: true,
      },
    ];
  }

  public async generate(request: AIRequest, modelOverride?: string): Promise<AIResponse> {
    const model = modelOverride ?? this.defaultModel;
    const userPrompt = buildPromptForRequest(request);

    try {
      const response = await this.client.models.generateContent({
        model,
        contents: [userPrompt],
        config: {
          systemInstruction: SYSTEM_INTERVIEW_COPILOT_PROMPT,
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      const rawText = response.text;
      if (!rawText) {
        throw new AIProviderError({
          message: "Gemini returned empty text response.",
          code: "INVALID_RESPONSE_SCHEMA",
          provider: this.id,
          isRetryable: true,
        });
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch (e) {
        throw new AIProviderError({
          message: "Gemini output was not valid JSON.",
          code: "INVALID_RESPONSE_SCHEMA",
          provider: this.id,
          isRetryable: true,
          cause: e,
        });
      }

      const validation = InterviewAnswerSchema.safeParse(parsedJson);
      if (!validation.success) {
        throw new AIProviderError({
          message: `Gemini JSON output failed domain schema: ${validation.error.message}`,
          code: "INVALID_RESPONSE_SCHEMA",
          provider: this.id,
          isRetryable: true,
        });
      }

      const usageMetadata = response.usageMetadata;
      const inputTokens = usageMetadata?.promptTokenCount;
      const outputTokens = usageMetadata?.candidatesTokenCount;
      const estimatedCostUsd =
        inputTokens && outputTokens
          ? (inputTokens / 1_000_000) * 0.1 + (outputTokens / 1_000_000) * 0.4
          : undefined;

      return {
        ...validation.data,
        provider: this.id,
        model,
        usage: {
          inputTokens,
          outputTokens,
          estimatedCostUsd: estimatedCostUsd
            ? Number(estimatedCostUsd.toFixed(5))
            : undefined,
        },
      };
    } catch (err: unknown) {
      if (err instanceof AIProviderError) throw err;
      throw new AIProviderError({
        message: err instanceof Error ? err.message : "Google Gemini API error",
        code: "PROVIDER_UNAVAILABLE",
        provider: this.id,
        isRetryable: true,
        cause: err,
      });
    }
  }

  public getRawClient(): GoogleGenAI {
    return this.client;
  }
}
