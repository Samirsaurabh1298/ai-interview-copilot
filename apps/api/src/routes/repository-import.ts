import type { FastifyPluginAsync } from "fastify";
import { ZipImportRequestSchema } from "@ai-copilot/contracts";
import { ZipIngestService, ZipIngestError } from "../services/zip-ingest.js";
import type { AuthService } from "../services/auth.js";
import { isTenantOrAuthForbiddenError } from "../services/auth.js";

export const repositoryImportRoutes: FastifyPluginAsync<{
  authService?: AuthService;
}> = async (fastify, opts) => {
  const { authService } = opts;
  const zipIngestService = new ZipIngestService();

  fastify.post("/repository/upload-zip", async (request, reply) => {
    // 1. RBAC Authentication Check
    if (authService && request.headers.authorization) {
      try {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        if (!["owner", "admin", "interviewer"].includes(auth.role)) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: `Role '${auth.role}' lacks permission to import repository archives`,
          });
        }
      } catch (err) {
        if (isTenantOrAuthForbiddenError(err)) {
          return reply.status(403).send({ error: "FORBIDDEN", message: err instanceof Error ? err.message : "Forbidden" });
        }
        return reply.status(401).send({ error: "UNAUTHORIZED", message: "Authentication required" });
      }
    }

    // 2. Request body validation
    const parse = ZipImportRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: "VALIDATION_FAILED",
        issues: parse.error.issues,
      });
    }

    try {
      const buffer = Buffer.from(parse.data.zipBase64, "base64");
      const result = zipIngestService.parseAndValidateZip(buffer);
      return reply.status(200).send(result);
    } catch (err) {
      if (err instanceof ZipIngestError) {
        let statusCode = 400;
        if (
          err.code === "ZIP_BOMB_DETECTED" ||
          err.code === "ZIP_EXCESSIVE_TOTAL_SIZE" ||
          err.code === "ZIP_EXCESSIVE_FILE_SIZE" ||
          err.code === "ZIP_EXCESSIVE_FILE_COUNT"
        ) {
          statusCode = 413;
        } else if (err.code === "ZIP_UNSUPPORTED_EXTENSION") {
          statusCode = 415;
        }

        return reply.status(statusCode).send({
          error: err.code,
          message: err.message,
          details: err.details,
        });
      }

      request.log.error({ err }, "Unexpected error processing zip archive");
      return reply.status(500).send({
        error: "ZIP_PROCESSING_FAILED",
        message: err instanceof Error ? err.message : "Internal error processing archive",
      });
    }
  });
};
