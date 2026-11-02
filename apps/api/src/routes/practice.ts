import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  PracticeDifficultySchema,
  PracticeSubmissionRequestSchema,
  PracticeTrackSchema,
} from "@ai-copilot/contracts";
import type { PracticeStudioService } from "../services/practice.js";

export interface PracticeRouteOptions {
  practiceService: PracticeStudioService;
}

export const practiceRoutes: FastifyPluginAsync<PracticeRouteOptions> = async (
  fastify: FastifyInstance,
  options: PracticeRouteOptions
) => {
  const { practiceService } = options;

  // List practice challenges (optionally filtered by track / difficulty)
  fastify.get("/challenges", async (request, reply) => {
    const query = request.query as { track?: string; difficulty?: string };

    let track;
    if (query.track) {
      const parsedTrack = PracticeTrackSchema.safeParse(query.track);
      if (parsedTrack.success) track = parsedTrack.data;
    }

    let difficulty;
    if (query.difficulty) {
      const parsedDiff = PracticeDifficultySchema.safeParse(query.difficulty);
      if (parsedDiff.success) difficulty = parsedDiff.data;
    }

    const challenges = practiceService.listChallenges(track, difficulty);
    return reply.status(200).send({
      challenges,
      total: challenges.length,
    });
  });

  // Get single challenge by ID or slug
  fastify.get("/challenges/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const challenge = practiceService.getChallengeById(id);

    if (!challenge) {
      return reply.status(404).send({
        error: "NOT_FOUND",
        message: `Practice challenge '${id}' not found`,
      });
    }

    return reply.status(200).send({ challenge });
  });

  // Evaluate candidate practice submission and generate diagnostic card
  fastify.post("/evaluate", async (request, reply) => {
    const parseResult = PracticeSubmissionRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        message: "Invalid practice submission payload",
        issues: parseResult.error.format(),
      });
    }

    const feedback = practiceService.evaluatePracticeSubmission(parseResult.data);
    return reply.status(200).send({ feedback });
  });
};

