import type { FastifyPluginAsync } from "fastify";
import {
  ScreenCaptureIngestRequestSchema,
  ExtractedChallengeResponseSchema,
} from "@ai-copilot/contracts";
import type { ScreenCaptureIngestService } from "../services/capture.js";
import type { PracticeStudioService } from "../services/practice.js";

export const captureRoutes: FastifyPluginAsync<{
  captureService: ScreenCaptureIngestService;
  practiceService?: PracticeStudioService;
}> = async (fastify, opts) => {
  const { captureService, practiceService } = opts;

  /**
   * POST /api/v1/capture/extract-question
   * Ingests a screenshot/image payload (base64 or data URL) and extracts a complete, executable coding challenge.
   */
  fastify.post("/extract-question", async (request, reply) => {
    const parseResult = ScreenCaptureIngestRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "Invalid screen capture request payload",
        details: parseResult.error.format(),
      });
    }

    try {
      const extracted = await captureService.extractChallengeFromImage(parseResult.data);
      const validated = ExtractedChallengeResponseSchema.safeParse(extracted);
      const finalData = validated.success ? validated.data : extracted;

      if (practiceService) {
        practiceService.registerChallenge({
          id: finalData.id,
          slug: finalData.id,
          title: finalData.title,
          track: finalData.track,
          difficulty: finalData.difficulty,
          language: finalData.language || "typescript",
          estimatedMinutes: finalData.timeLimitMinutes,
          description: finalData.description,
          starterCode: finalData.starterCode,
          verificationTestCode: finalData.testHarnessCode,
          hints: finalData.hints,
          simulatedAiBudgetUsd: 0.25,
          tags: ["ocr-ingested", finalData.detectedSource],
        });
      }

      return reply.status(200).send(finalData);
    } catch (err: unknown) {
      request.log.error({ err }, "Failed to extract challenge from image");
      return reply.status(500).send({
        error: "Image question extraction failed",
        message: err instanceof Error ? err.message : "Internal extraction error",
      });
    }
  });

  /**
   * GET /api/v1/capture/sample-presets
   * Returns preloaded sample presets for immediate 1-click OCR demonstration.
   */
  fastify.get("/sample-presets", async (_request, reply) => {
    const presets = captureService.getSamplePresets();
    return reply.status(200).send({
      presets,
      total: presets.length,
    });
  });
};

