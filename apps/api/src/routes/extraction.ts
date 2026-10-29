import type { FastifyPluginAsync } from "fastify";
import {
  QuestionExtractionRequestSchema,
  type QuestionExtractionResponse,
} from "@ai-copilot/contracts";

export const extractionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/extract", async (request, reply) => {
    const parseResult = QuestionExtractionRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "Invalid extraction request payload",
        details: parseResult.error.format(),
      });
    }

    // Extraction processing: In MVP/Local mode, return structured extraction for user confirmation.
    // Can be plugged into Tesseract, Windows OCR, or multimodal LLM vision.
    const response: QuestionExtractionResponse = {
      rawText: "Sample extracted question from image context",
      cleanedQuestion:
        parseResult.data.userHint ??
        "Extracted coding question: Analyze and optimize the given function.",
      codeSnippet: "function example() {\n  return 42;\n}",
      languageHint: "typescript",
      confidence: 0.92,
      ambiguities: [],
      requiresUserCorrection: false,
    };

    return reply.status(200).send(response);
  });
};

