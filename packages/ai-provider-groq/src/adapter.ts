import OpenAI from "openai";
import type {
  AIRequest,
  AIResponse,
  ModelCapability,
  QuestionExtractionResponse,
} from "@ai-copilot/contracts";
import { InterviewAnswerSchema } from "@ai-copilot/contracts";
import type { AIProvider } from "@ai-copilot/ai-core";
import {
  AIProviderError,
  SYSTEM_INTERVIEW_COPILOT_PROMPT,
  buildPromptForRequest,
} from "@ai-copilot/ai-core";
import { extractQuestionWithGroq } from "./vision.js";

const DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b";

export class GroqProvider implements AIProvider {
  public readonly id = "groq" as const;
  public readonly name = "Groq LPU (Ultra-Fast)";
  public readonly defaultModel = DEFAULT_GROQ_MODEL;

  private client: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.GROQ_API_KEY;
    if (!key) {
      throw new AIProviderError({
        message: "GROQ_API_KEY is not configured.",
        code: "AUTHENTICATION_FAILED",
        provider: this.id,
        isRetryable: false,
      });
    }

    this.client = new OpenAI({
      apiKey: key,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }

  public async getCapabilities(): Promise<ModelCapability[]> {
    return [
      {
        id: DEFAULT_GROQ_MODEL,
        name: "Qwen 3.8 27B (Groq LPU)",
        provider: "groq",
        supportsVision: false,
        supportsStreaming: true,
        supportsStructuredOutput: true,
        contextWindow: 128000,
        costPerMillionInputTokensUsd: 0.1,
        costPerMillionOutputTokensUsd: 0.4,
        isRecommended: true,
      },
      {
        id: "openai/gpt-oss-120b",
        name: "GPT-OSS 120B (Groq LPU)",
        provider: "groq",
        supportsVision: false,
        supportsStreaming: true,
        supportsStructuredOutput: true,
        contextWindow: 128000,
        costPerMillionInputTokensUsd: 0.2,
        costPerMillionOutputTokensUsd: 0.8,
        isRecommended: false,
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
        max_tokens: 850,
      });

      const messageContent = completion.choices[0]?.message.content;
      if (!messageContent) {
        throw new AIProviderError({
          message: "Groq returned empty message content",
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
          message: "Groq output was not valid JSON",
          code: "INVALID_RESPONSE_SCHEMA",
          provider: this.id,
          isRetryable: true,
          cause: e,
        });
      }

      const validation = InterviewAnswerSchema.safeParse(parsedJson);
      if (!validation.success) {
        throw new AIProviderError({
          message: `Groq output failed domain schema: ${validation.error.message}`,
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
      if (err instanceof AIProviderError) {
        throw err;
      }

      const status = (err as { status?: number })?.status;
      const isRateLimit = status === 429;
      const isAuth = status === 401;

      throw new AIProviderError({
        message: err instanceof Error ? err.message : "Unknown Groq error",
        code: isAuth
          ? "AUTHENTICATION_FAILED"
          : isRateLimit
          ? "RATE_LIMIT_EXCEEDED"
          : "PROVIDER_UNAVAILABLE",
        provider: this.id,
        isRetryable: isRateLimit || status === 500 || status === 503,
        cause: err,
      });
    }
  }

  public async extractQuestion(imageInput: string): Promise<QuestionExtractionResponse> {
    return extractQuestionWithGroq(this.client, imageInput, this.defaultModel);
  }
}
