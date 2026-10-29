import OpenAI from "openai";
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

const GPT_4O_MODEL = "gpt-4o";

export class OpenAIProvider implements AIProvider {
  public readonly id = "openai" as const;
  public readonly name = "OpenAI GPT-4o";
  public readonly defaultModel = GPT_4O_MODEL;

  private client: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.OPENAI_API_KEY;
    if (!key) {
      throw new AIProviderError({
        message: "OPENAI_API_KEY is not configured.",
        code: "AUTHENTICATION_FAILED",
        provider: this.id,
        isRetryable: false,
      });
    }

    this.client = new OpenAI({ apiKey: key });
  }

  public async getCapabilities(): Promise<ModelCapability[]> {
    return [
      {
        id: GPT_4O_MODEL,
        name: "GPT-4o",
        provider: "openai",
        supportsVision: true,
        supportsStreaming: true,
        supportsStructuredOutput: true,
        contextWindow: 128000,
        costPerMillionInputTokensUsd: 2.5,
        costPerMillionOutputTokensUsd: 10.0,
        isRecommended: true,
      },
    ];
  }

  public async generate(request: AIRequest, modelOverride?: string): Promise<AIResponse> {
    const model = modelOverride ?? this.defaultModel;
    const userPrompt = buildPromptForRequest(request);

    try {
      const completion = await this.client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM_INTERVIEW_COPILOT_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const messageContent = completion.choices[0]?.message.content;
      if (!messageContent) {
        throw new AIProviderError({
          message: "OpenAI returned empty message content",
          code: "INVALID_RESPONSE_SCHEMA",
          provider: this.id,
          isRetryable: true,
        });
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(messageContent);
      } catch (e) {
        throw new AIProviderError({
          message: "OpenAI output was not valid JSON",
          code: "INVALID_RESPONSE_SCHEMA",
          provider: this.id,
          isRetryable: true,
          cause: e,
        });
      }

      const validation = InterviewAnswerSchema.safeParse(parsedJson);
      if (!validation.success) {
        throw new AIProviderError({
          message: `OpenAI output failed domain schema: ${validation.error.message}`,
          code: "INVALID_RESPONSE_SCHEMA",
          provider: this.id,
          isRetryable: true,
        });
      }

      const usage = completion.usage;
      const inputTokens = usage?.prompt_tokens;
      const outputTokens = usage?.completion_tokens;
      const estimatedCostUsd =
        inputTokens && outputTokens
          ? (inputTokens / 1_000_000) * 2.5 + (outputTokens / 1_000_000) * 10.0
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
      throw this.normalizeOpenAIError(err);
    }
  }

  public getRawClient(): OpenAI {
    return this.client;
  }

  private normalizeOpenAIError(err: unknown): AIProviderError {
    if (err instanceof OpenAI.APIError) {
      const status = err.status;
      if (status === 401) {
        return new AIProviderError({
          message: "Invalid OpenAI API key.",
          code: "AUTHENTICATION_FAILED",
          provider: this.id,
          isRetryable: false,
          cause: err,
        });
      }
      if (status === 429) {
        return new AIProviderError({
          message: "OpenAI rate limit or quota exceeded.",
          code: "RATE_LIMIT_EXCEEDED",
          provider: this.id,
          isRetryable: true,
          retryAfterMs: 2000,
          cause: err,
        });
      }
      if (status && status >= 500) {
        return new AIProviderError({
          message: "OpenAI server error.",
          code: "PROVIDER_UNAVAILABLE",
          provider: this.id,
          isRetryable: true,
          cause: err,
        });
      }
    }

    return new AIProviderError({
      message: err instanceof Error ? err.message : "OpenAI API invocation error",
      code: "PROVIDER_UNAVAILABLE",
      provider: this.id,
      isRetryable: false,
      cause: err,
    });
  }
}
