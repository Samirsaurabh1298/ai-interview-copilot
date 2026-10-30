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
const FALLBACK_GROQ_MODEL = "openai/gpt-oss-120b";

function repairAndParseJson(raw?: string | null): any {
  if (!raw) return null;
  const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(clean);
  } catch {}

  const match = clean.match(/(\{[\s\S]*\})/);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1]);
    } catch {}
  }

  // Attempt to repair truncation (e.g. unclosed quotes, unclosed arrays/objects)
  let trimmed = clean.replace(/,\s*$/, "");
  const quoteCount = (trimmed.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    trimmed += '"';
  }

  const openBrackets = (trimmed.match(/\[/g) || []).length;
  const closeBrackets = (trimmed.match(/\]/g) || []).length;
  for (let i = 0; i < openBrackets - closeBrackets; i++) trimmed += "]";

  const openBraces = (trimmed.match(/\{/g) || []).length;
  const closeBraces = (trimmed.match(/\}/g) || []).length;
  for (let i = 0; i < openBraces - closeBraces; i++) trimmed += "}";

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function normalizeCategory(raw: unknown): "debugging" | "code-comprehension" | "implementation" | "refactoring" | "testing" | "javascript" | "react" | "system-design" | "other" {
  if (typeof raw !== "string") return "debugging";
  const s = raw.toLowerCase().trim();
  if (s.includes("debug") || s.includes("fix") || s.includes("bug")) return "debugging";
  if (s.includes("comprehen") || s.includes("explain")) return "code-comprehension";
  if (s.includes("implement") || s.includes("create")) return "implementation";
  if (s.includes("refactor")) return "refactoring";
  if (s.includes("test")) return "testing";
  if (s.includes("react")) return "react";
  if (s.includes("system") || s.includes("design") || s.includes("arch")) return "system-design";
  if (s.includes("script") || s.includes("ts") || s.includes("js")) return "javascript";
  return "other";
}

function normalizeToInterviewAnswer(parsed: any, request: AIRequest): any {
  if (!parsed || typeof parsed !== "object") {
    return {
      question: request.question,
      category: "debugging",
      assumptions: [],
      diagnosis: [],
      approach: [],
      codeChanges: [],
      explanation: "Analysis completed.",
      followUpQuestions: [],
      limitations: [],
    };
  }

  const explanation =
    typeof parsed.explanation === "string" && parsed.explanation.trim().length > 0
      ? parsed.explanation
      : Array.isArray(parsed.diagnosis) && parsed.diagnosis.length > 0
      ? parsed.diagnosis.join("\n")
      : "Analysis completed successfully.";

  return {
    question:
      typeof parsed.question === "string" && parsed.question.trim().length > 0
        ? parsed.question
        : request.question,
    category: normalizeCategory(parsed.category),
    assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.map(String) : [],
    diagnosis: Array.isArray(parsed.diagnosis) ? parsed.diagnosis.map(String) : [],
    approach: Array.isArray(parsed.approach) ? parsed.approach.map(String) : [],
    codeChanges: Array.isArray(parsed.codeChanges) ? parsed.codeChanges : [],
    code: typeof parsed.code === "string" ? parsed.code : undefined,
    timeComplexity: typeof parsed.timeComplexity === "string" ? parsed.timeComplexity : undefined,
    spaceComplexity: typeof parsed.spaceComplexity === "string" ? parsed.spaceComplexity : undefined,
    tests: Array.isArray(parsed.tests) ? parsed.tests : [],
    edgeCases: Array.isArray(parsed.edgeCases) ? parsed.edgeCases.map(String) : [],
    explanation,
    followUpQuestions: Array.isArray(parsed.followUpQuestions)
      ? parsed.followUpQuestions.map(String)
      : [],
    confidence:
      typeof parsed.confidence === "number"
        ? Math.min(Math.max(parsed.confidence, 0), 1)
        : 0.9,
    limitations: Array.isArray(parsed.limitations) ? parsed.limitations.map(String) : [],
  };
}

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
        id: FALLBACK_GROQ_MODEL,
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

    let messageContent: string | null | undefined;
    let completionUsage: OpenAI.Completions.CompletionUsage | undefined;
    let usedModel = model;

    try {
      const completion = await this.client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM_INTERVIEW_COPILOT_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2400,
      });

      messageContent = completion.choices[0]?.message.content;
      completionUsage = completion.usage;
    } catch (err: unknown) {
      const errorObj = err as { status?: number; error?: { failed_generation?: string; code?: string } };
      
      // If Groq reported json_validate_failed and provided failed_generation, try to salvage it
      if (errorObj?.error?.failed_generation) {
        messageContent = errorObj.error.failed_generation;
      } else {
        // Fast fallback retry with GPT-OSS 120B on Groq
        try {
          usedModel = model === FALLBACK_GROQ_MODEL ? DEFAULT_GROQ_MODEL : FALLBACK_GROQ_MODEL;
          const fallbackCompletion = await this.client.chat.completions.create({
            model: usedModel,
            messages: [
              { role: "system", content: SYSTEM_INTERVIEW_COPILOT_PROMPT },
              { role: "user", content: `${userPrompt}\n\nCRITICAL: Respond with a single raw JSON object adhering to the schema.` },
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
            max_tokens: 2400,
          });

          messageContent = fallbackCompletion.choices[0]?.message.content;
          completionUsage = fallbackCompletion.usage;
        } catch (fallbackErr) {
          if (err instanceof AIProviderError) throw err;

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
    }

    if (!messageContent) {
      throw new AIProviderError({
        message: "Groq returned empty message content",
        code: "INVALID_RESPONSE_SCHEMA",
        provider: this.id,
        isRetryable: true,
      });
    }

    const parsedJson = repairAndParseJson(messageContent);
    if (!parsedJson) {
      throw new AIProviderError({
        message: "Failed to parse structured response from Groq",
        code: "INVALID_RESPONSE_SCHEMA",
        provider: this.id,
        isRetryable: true,
      });
    }

    const normalizedData = normalizeToInterviewAnswer(parsedJson, request);
    const validation = InterviewAnswerSchema.safeParse(normalizedData);
    if (!validation.success) {
      throw new AIProviderError({
        message: `Groq output failed domain schema: ${validation.error.message}`,
        code: "INVALID_RESPONSE_SCHEMA",
        provider: this.id,
        isRetryable: true,
      });
    }

    const inputTokens = completionUsage?.prompt_tokens;
    const outputTokens = completionUsage?.completion_tokens;
    const estimatedCostUsd =
      inputTokens && outputTokens
        ? (inputTokens / 1_000_000) * 0.1 + (outputTokens / 1_000_000) * 0.4
        : undefined;

    return {
      ...validation.data,
      provider: this.id,
      model: usedModel,
      usage: {
        inputTokens,
        outputTokens,
        estimatedCostUsd: estimatedCostUsd
          ? Number(estimatedCostUsd.toFixed(5))
          : undefined,
      },
    };
  }

  public async extractQuestion(imageInput: string): Promise<QuestionExtractionResponse> {
    return extractQuestionWithGroq(this.client, imageInput, this.defaultModel);
  }
}
