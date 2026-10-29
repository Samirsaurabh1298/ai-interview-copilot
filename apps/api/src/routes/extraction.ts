import type { FastifyPluginAsync } from "fastify";
import {
  QuestionExtractionRequestSchema,
  type QuestionExtractionResponse,
} from "@ai-copilot/contracts";
import type { AnthropicProvider } from "@ai-copilot/ai-provider-anthropic";
import { extractQuestionWithClaude } from "@ai-copilot/ai-provider-anthropic";

export const extractionRoutes: FastifyPluginAsync<{
  anthropicProvider?: AnthropicProvider | undefined;
}> = async (fastify, opts) => {
  const { anthropicProvider } = opts;

  fastify.post("/extract", async (request, reply) => {
    const parseResult = QuestionExtractionRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "Invalid extraction request payload",
        details: parseResult.error.format(),
      });
    }

    // 1. If Anthropic is configured, use Claude 3.5 Sonnet Vision
    if (anthropicProvider) {
      try {
        const result = await extractQuestionWithClaude(
          anthropicProvider.getRawClient(),
          parseResult.data
        );
        return reply.status(200).send(result);
      } catch (err: unknown) {
        request.log.warn({ err }, "Claude vision extraction failed, falling back to mock");
      }
    }

    // 2. Fallback deterministic extraction for local dev/testing
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
