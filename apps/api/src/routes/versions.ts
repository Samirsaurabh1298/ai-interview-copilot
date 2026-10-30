import type { FastifyPluginAsync } from "fastify";
import { PublishVersionRequestSchema } from "@ai-copilot/contracts";
import type { AssessmentVersioningService } from "../services/versioning.js";
import { VersionNotFoundError } from "../services/versioning.js";
import type { AssessmentTemplateService } from "../services/template.js";
import type { AuthService } from "../services/auth.js";

export const versionsRoutes: FastifyPluginAsync<{
  versioningService: AssessmentVersioningService;
  templateService: AssessmentTemplateService;
  authService?: AuthService;
}> = async (fastify, opts) => {
  const { versioningService, templateService, authService } = opts;

  // 1. Publish Immutable Version
  fastify.post("/templates/:templateId/versions", async (request, reply) => {
    const { templateId } = request.params as { templateId: string };
    const query = request.query as { organizationId?: string };

    const rawBody = (request.body as Record<string, any>) || {};
    const orgId = rawBody.organizationId || query?.organizationId;

    const parse = PublishVersionRequestSchema.safeParse({
      ...rawBody,
      templateId,
      organizationId: orgId,
    });

    if (!parse.success) {
      return reply.status(400).send({
        error: "VALIDATION_FAILED",
        issues: parse.error.issues,
      });
    }

    try {
      if (authService && request.headers.authorization) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, parse.data.organizationId);
        if (!["owner", "admin"].includes(auth.role)) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: `Role '${auth.role}' lacks permission to publish assessment versions`,
          });
        }
      }

      const version = versioningService.publishVersion(parse.data, templateService);
      return reply.status(201).send(version);
    } catch (err) {
      if (err instanceof VersionNotFoundError) {
        return reply.status(404).send({ error: "TEMPLATE_NOT_FOUND", message: err.message });
      }
      throw err;
    }
  });

  // 2. List Versions for a Template
  fastify.get("/templates/:templateId/versions", async (request, reply) => {
    const { templateId } = request.params as { templateId: string };
    const query = request.query as { organizationId?: string };
    const orgId = query?.organizationId;

    if (!orgId) {
      return reply.status(400).send({
        error: "MISSING_ORGANIZATION_ID",
        message: "Query parameter 'organizationId' is required",
      });
    }

    const versions = versioningService.listVersionsForTemplate(templateId, orgId);
    return reply.status(200).send({ versions, total: versions.length });
  });

  // 3. Get Immutable Version by ID
  fastify.get("/versions/:versionId", async (request, reply) => {
    const { versionId } = request.params as { versionId: string };
    const query = request.query as { organizationId?: string };
    const version = versioningService.getVersionById(versionId, query?.organizationId);

    if (!version) {
      return reply.status(404).send({
        error: "VERSION_NOT_FOUND",
        message: `Assessment version '${versionId}' not found`,
      });
    }

    return reply.status(200).send(version);
  });

  // 4. Verify Cryptographic Integrity
  fastify.get("/versions/:versionId/verify", async (request, reply) => {
    const { versionId } = request.params as { versionId: string };
    try {
      const verification = versioningService.verifyVersionIntegrity(versionId);
      return reply.status(200).send(verification);
    } catch (err) {
      if (err instanceof VersionNotFoundError) {
        return reply.status(404).send({ error: "VERSION_NOT_FOUND", message: err.message });
      }
      throw err;
    }
  });
};

