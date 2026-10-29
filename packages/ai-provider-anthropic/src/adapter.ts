import Anthropic from "@anthropic-ai/sdk";
import type {
  AIRequest,
  AIResponse,
  ModelCapability,
  InterviewAnswer,
} from "@ai-copilot/contracts";
import { InterviewAnswerSchema } from "@ai-copilot/contracts";
import type { AIProvider } from "@ai-copilot/ai-core";
import {
  AIProviderError,
  SYSTEM_INTERVIEW_COPILOT_PROMPT,
  buildPromptForRequest,
} from "@ai-copilot/ai-core";

const CLAUDE_SONNET_MODEL = "claude-3-5-sonnet-20241022";

// JSON Schema definition for tool-enforced output
const INTERVIEW_ANSWER_TOOL_SCHEMA: Anthropic.Tool = {
  name: "submit_interview_analysis",
  description: "Submit the structured technical analysis, code diff, tests, and explanation.",
  input_schema: {
    type: "object",
    properties: {
      question: { type: "string", description: "The core question or bug description" },
      category: {
        type: "string",
        enum: [
          "code-comprehension",
          "debugging",
          "implementation",
          "refactoring",
          "testing",
          "javascript",
          "react",
          "system-design",
          "other",
        ],
      },
      assumptions: {
        type: "array",
        items: { type: "string" },
        description: "Verified facts vs assumptions made",
      },
      diagnosis: {
        type: "array",
        items: { type: "string" },
        description: "Identified root causes and code smells",
      },
      approach: {
        type: "array",
        items: { type: "string" },
        description: "Step-by-step engineering plan",
      },
      codeChanges: {
        type: "array",
        items: {
          type: "object",
          properties: {
            path: { type: "string" },
            description: { type: "string" },
            diff: { type: "string" },
          },
          required: ["description"],
        },
        description: "Minimal unified diff patches",
      },
      code: { type: "string", description: "Full verified solution code if applicable" },
      timeComplexity: { type: "string", description: "e.g. O(n log n)" },
      spaceComplexity: { type: "string", description: "e.g. O(1)" },
      tests: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            purpose: { type: "string" },
            expectedResult: { type: "string" },
          },
          required: ["name", "purpose"],
        },
      },
      edgeCases: {
        type: "array",
        items: { type: "string" },
      },
      explanation: {
        type: "string",
        description: "Clear, in-depth engineering explanation without decorative fluff",
      },
      followUpQuestions: {
        type: "array",
        items: { type: "string" },
        description: "Relevant interview follow-up topics to practice",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
      limitations: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["question", "category", "explanation", "approach", "tests"],
  },
};

export class AnthropicProvider implements AIProvider {
  public readonly id = "anthropic" as const;
  public readonly name = "Anthropic Claude 3.5 Sonnet";
  public readonly defaultModel = CLAUDE_SONNET_MODEL;

  private client: Anthropic;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new AIProviderError({
        message: "ANTHROPIC_API_KEY is not configured.",
        code: "AUTHENTICATION_FAILED",
        provider: this.id,
        isRetryable: false,
      });
    }

    this.client = new Anthropic({ apiKey: key });
  }

  public async getCapabilities(): Promise<ModelCapability[]> {
    return [
      {
        id: CLAUDE_SONNET_MODEL,
        name: "Claude 3.5 Sonnet",
        provider: "anthropic",
        supportsVision: true,
        supportsStreaming: true,
        supportsStructuredOutput: true,
        contextWindow: 200000,
        costPerMillionInputTokensUsd: 3.0,
        costPerMillionOutputTokensUsd: 15.0,
        isRecommended: true,
      },
    ];
  }

  public async generate(request: AIRequest, modelOverride?: string): Promise<AIResponse> {
    const model = modelOverride ?? this.defaultModel;
    const userPrompt = buildPromptForRequest(request);

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: 4096,
        system: SYSTEM_INTERVIEW_COPILOT_PROMPT,
        tools: [INTERVIEW_ANSWER_TOOL_SCHEMA],
        tool_choice: { type: "tool", name: "submit_interview_analysis" },
        messages: [{ role: "user", content: userPrompt }],
      });

      // Extract tool call
      const toolUseBlock = response.content.find((block) => block.type === "tool_use");
      if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
        throw new AIProviderError({
          message: "Claude did not return structured analysis block.",
          code: "INVALID_RESPONSE_SCHEMA",
          provider: this.id,
          isRetryable: true,
        });
      }

      // Validate against domain schema
      const parsed = InterviewAnswerSchema.safeParse(toolUseBlock.input);
      if (!parsed.success) {
        throw new AIProviderError({
          message: `Claude output failed domain validation: ${parsed.error.message}`,
          code: "INVALID_RESPONSE_SCHEMA",
          provider: this.id,
          isRetryable: true,
        });
      }

      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const estimatedCostUsd =
        (inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0;

      return {
        ...parsed.data,
        provider: this.id,
        model,
        usage: {
          inputTokens,
          outputTokens,
          estimatedCostUsd: Number(estimatedCostUsd.toFixed(5)),
        },
      };
    } catch (err: unknown) {
      if (err instanceof AIProviderError) throw err;
      throw this.normalizeAnthropicError(err);
    }
  }

  public getRawClient(): Anthropic {
    return this.client;
  }

  private normalizeAnthropicError(err: unknown): AIProviderError {
    if (err instanceof Anthropic.APIError) {
      const status = err.status;
      if (status === 401) {
        return new AIProviderError({
          message: "Invalid Anthropic API key.",
          code: "AUTHENTICATION_FAILED",
          provider: this.id,
          isRetryable: false,
          cause: err,
        });
      }
      if (status === 429) {
        return new AIProviderError({
          message: "Anthropic rate limit exceeded.",
          code: "RATE_LIMIT_EXCEEDED",
          provider: this.id,
          isRetryable: true,
          retryAfterMs: 2000,
          cause: err,
        });
      }
      if (status === 529 || (status && status >= 500)) {
        return new AIProviderError({
          message: "Anthropic server currently overloaded.",
          code: "PROVIDER_UNAVAILABLE",
          provider: this.id,
          isRetryable: true,
          cause: err,
        });
      }
    }

    return new AIProviderError({
      message: err instanceof Error ? err.message : "Anthropic invocation error",
      code: "PROVIDER_UNAVAILABLE",
      provider: this.id,
      isRetryable: false,
      cause: err,
    });
  }
}

