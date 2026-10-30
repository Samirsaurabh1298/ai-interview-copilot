import type { FastifyPluginAsync } from "fastify";
import {
  CreateTemplateRequestSchema,
  UpdateTemplateRequestSchema,
} from "@ai-copilot/contracts";
import type { AssessmentTemplateService } from "../services/template.js";
import { TemplateNotFoundError, TemplateConflictError } from "../services/template.js";
import type { AuthService } from "../services/auth.js";

export const templatesRoutes: FastifyPluginAsync<{
  templateService: AssessmentTemplateService;
  authService?: AuthService;
}> = async (fastify, opts) => {
  const { templateService, authService } = opts;

  // 1. Create Template
  fastify.post("/", async (request, reply) => {
    const parse = CreateTemplateRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: "VALIDATION_FAILED",
        issues: parse.error.issues,
      });
    }

    try {
      // Optional RBAC check if auth header is provided
      if (authService && request.headers.authorization) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, parse.data.organizationId);
        if (!["owner", "admin"].includes(auth.role)) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: `Role '${auth.role}' lacks permission to create templates`,
          });
        }
      }

      const template = templateService.createTemplate(parse.data);
      return reply.status(201).send(template);
    } catch (err) {
      if (err instanceof TemplateConflictError) {
        return reply.status(409).send({ error: "TEMPLATE_SLUG_CONFLICT", message: err.message });
      }
      throw err;
    }
  });

  // 2. List Templates for an Organization
  fastify.get("/", async (request, reply) => {
    const query = request.query as { organizationId?: string };
    let orgId = query?.organizationId;

    if (!orgId && authService && request.headers.authorization) {
      try {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        orgId = auth.organizationId;
      } catch {
        // Continue
      }
    }

    if (!orgId) {
      return reply.status(400).send({
        error: "MISSING_ORGANIZATION_ID",
        message: "Query parameter 'organizationId' or Authorization header is required",
      });
    }

    const templates = templateService.listTemplates(orgId);
    return reply.status(200).send({ templates, total: templates.length });
  });

  // 3. Get Template by ID
  fastify.get("/:templateId", async (request, reply) => {
    const { templateId } = request.params as { templateId: string };
    const query = request.query as { organizationId?: string };
    const orgId = query?.organizationId;

    if (!orgId) {
      return reply.status(400).send({
        error: "MISSING_ORGANIZATION_ID",
        message: "Query parameter 'organizationId' is required",
      });
    }

    const template = templateService.getTemplateById(orgId, templateId);
    if (!template) {
      return reply.status(404).send({
        error: "TEMPLATE_NOT_FOUND",
        message: `Template '${templateId}' not found in organization '${orgId}'`,
      });
    }

    return reply.status(200).send(template);
  });

  // 4. Update Template
  fastify.patch("/:templateId", async (request, reply) => {
    const { templateId } = request.params as { templateId: string };
    const query = request.query as { organizationId?: string };
    const orgId = query?.organizationId;

    if (!orgId) {
      return reply.status(400).send({
        error: "MISSING_ORGANIZATION_ID",
        message: "Query parameter 'organizationId' is required",
      });
    }

    const parse = UpdateTemplateRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: "VALIDATION_FAILED",
        issues: parse.error.issues,
      });
    }

    try {
      if (authService && request.headers.authorization) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, orgId);
        if (!["owner", "admin"].includes(auth.role)) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: `Role '${auth.role}' lacks permission to modify templates`,
          });
        }
      }

      const updated = templateService.updateTemplate(orgId, templateId, parse.data);
      return reply.status(200).send(updated);
    } catch (err) {
      if (err instanceof TemplateNotFoundError) {
        return reply.status(404).send({ error: "TEMPLATE_NOT_FOUND", message: err.message });
      }
      throw err;
    }
  });

  // 5. Publish Template
  fastify.post("/:templateId/publish", async (request, reply) => {
    const { templateId } = request.params as { templateId: string };
    const query = request.query as { organizationId?: string };
    const orgId = query?.organizationId;

    if (!orgId) {
      return reply.status(400).send({
        error: "MISSING_ORGANIZATION_ID",
        message: "Query parameter 'organizationId' is required",
      });
    }

    try {
      if (authService && request.headers.authorization) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, orgId);
        if (!["owner", "admin"].includes(auth.role)) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: `Role '${auth.role}' lacks permission to publish templates`,
          });
        }
      }

      const published = templateService.publishTemplate(orgId, templateId);
      return reply.status(200).send(published);
    } catch (err) {
      if (err instanceof TemplateNotFoundError) {
        return reply.status(404).send({ error: "TEMPLATE_NOT_FOUND", message: err.message });
      }
      throw err;
    }
  });

  // 6. Delete Template
  fastify.delete("/:templateId", async (request, reply) => {
    const { templateId } = request.params as { templateId: string };
    const query = request.query as { organizationId?: string };
    const orgId = query?.organizationId;

    if (!orgId) {
      return reply.status(400).send({
        error: "MISSING_ORGANIZATION_ID",
        message: "Query parameter 'organizationId' is required",
      });
    }

    try {
      if (authService && request.headers.authorization) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, orgId);
        if (!["owner", "admin"].includes(auth.role)) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: `Role '${auth.role}' lacks permission to delete templates`,
          });
        }
      }

      templateService.deleteTemplate(orgId, templateId);
      return reply.status(204).send();
    } catch (err) {
      if (err instanceof TemplateNotFoundError) {
        return reply.status(404).send({ error: "TEMPLATE_NOT_FOUND", message: err.message });
      }
      throw err;
    }
  });
};

