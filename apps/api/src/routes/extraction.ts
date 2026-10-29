import type { FastifyPluginAsync } from "fastify";
import {
  QuestionExtractionRequestSchema,
  type QuestionExtractionResponse,
} from "@ai-copilot/contracts";
import type { AnthropicProvider } from "@ai-copilot/ai-provider-anthropic";
import { extractQuestionWithClaude } from "@ai-copilot/ai-provider-anthropic";
import type { GoogleGeminiProvider } from "@ai-copilot/ai-provider-google";
import { extractQuestionWithGemini } from "@ai-copilot/ai-provider-google";
import type { OpenAIProvider } from "@ai-copilot/ai-provider-openai";
import { extractQuestionWithOpenAI } from "@ai-copilot/ai-provider-openai";

export const extractionRoutes: FastifyPluginAsync<{
  anthropicProvider?: AnthropicProvider | undefined;
  googleProvider?: GoogleGeminiProvider | undefined;
  openaiProvider?: OpenAIProvider | undefined;
}> = async (fastify, opts) => {
  const { anthropicProvider, googleProvider, openaiProvider } = opts;

  fastify.post("/extract", async (request, reply) => {
    const parseResult = QuestionExtractionRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "Invalid extraction request payload",
        details: parseResult.error.format(),
      });
    }

    // 1. Prefer Google Gemini Flash for vision if configured (Fastest & lowest token cost)
    if (googleProvider) {
      try {
        const result = await extractQuestionWithGemini(
          googleProvider.getRawClient(),
          parseResult.data
        );
        return reply.status(200).send(result);
      } catch (err: unknown) {
        request.log.warn({ err }, "Gemini vision failed, trying fallback");
      }
    }

    // 2. Fallback to Claude 3.5 Sonnet Vision if configured
    if (anthropicProvider) {
      try {
        const result = await extractQuestionWithClaude(
          anthropicProvider.getRawClient(),
          parseResult.data
        );
        return reply.status(200).send(result);
      } catch (err: unknown) {
        request.log.warn({ err }, "Claude vision failed, trying fallback");
      }
    }

    // 3. Fallback to OpenAI GPT-4o Vision if configured
    if (openaiProvider) {
      try {
        const result = await extractQuestionWithOpenAI(
          openaiProvider.getRawClient(),
          parseResult.data
        );
        return reply.status(200).send(result);
      } catch (err: unknown) {
        request.log.warn({ err }, "OpenAI vision failed, falling back to mock");
      }
    }

    // 4. Offline / test mock extraction fallback
    const response: QuestionExtractionResponse = {
      rawText: "Sample extracted question from image context",
      cleanedQuestion:
        parseResult.data.userHint ??
        "Extracted coding problem: Implement an LRU Cache with O(1) get and put operations.",
      codeSnippet:
        "class LRUCache {\n  constructor(capacity: number) {}\n  get(key: number): number {}\n  put(key: number, value: number): void {}\n}",
      languageHint: "typescript",
      confidence: 0.95,
      ambiguities: [],
      requiresUserCorrection: false,
    };

    return reply.status(200).send(response);
  });
};
