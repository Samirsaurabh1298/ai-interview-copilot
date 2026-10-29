import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  indexRepository,
  retrieveRelevantContext,
  type RepoIndex,
} from "@ai-copilot/context-engine";

let cachedIndex: RepoIndex | null = null;

const IndexRepoSchema = z.object({
  directoryPath: z.string().min(1, "Directory path is required"),
});

const RetrieveContextSchema = z.object({
  query: z.string().min(1, "Query is required"),
  maxFiles: z.number().int().min(1).max(20).default(5),
});

export const contextRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/index", async (request, reply) => {
    const parseResult = IndexRepoSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parseResult.error.format(),
      });
    }

    try {
      cachedIndex = indexRepository(parseResult.data.directoryPath);
      return reply.status(200).send({
        success: true,
        repoRoot: cachedIndex.repoRoot,
        totalFiles: cachedIndex.totalFiles,
        indexedAt: cachedIndex.indexedAt,
      });
    } catch (err: unknown) {
      request.log.error({ err }, "Indexing failure");
      return reply.status(400).send({
        error: "Indexing failed",
        message: err instanceof Error ? err.message : "Unable to index directory",
      });
    }
  });

  fastify.post("/retrieve", async (request, reply) => {
    if (!cachedIndex) {
      return reply.status(400).send({
        error: "No repository indexed",
        message: "Please index a repository directory before retrieving context.",
      });
    }

    const parseResult = RetrieveContextSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parseResult.error.format(),
      });
    }

    const items = retrieveRelevantContext(cachedIndex, parseResult.data.query, {
      maxFiles: parseResult.data.maxFiles,
    });

    return reply.status(200).send({
      query: parseResult.data.query,
      items,
      count: items.length,
    });
  });
};
