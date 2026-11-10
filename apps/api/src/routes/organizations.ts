import type { FastifyPluginAsync } from "fastify";
import {
  CreateOrganizationRequestSchema,
  InviteMemberRequestSchema,
  UpdateMemberRoleRequestSchema,
} from "@ai-copilot/contracts";
import {
  OrganizationService,
  TenantNotFoundError,
  MembershipConflictError,
  MemberNotFoundError,
  TenantOperationForbiddenError,
} from "../services/organization.js";
import type { AuthService } from "../services/auth.js";
import {
  TenantAccessDeniedError,
  AuthorizationError,
  isTenantOrAuthForbiddenError,
} from "../services/auth.js";

export const organizationsRoutes: FastifyPluginAsync<{
  orgService: OrganizationService;
  authService?: AuthService;
}> = async (fastify, opts) => {
  const { orgService, authService } = opts;

  // 0. List Organizations
  fastify.get("/", async (_request, reply) => {
    const list = orgService.listOrganizations();
    return reply.status(200).send({ organizations: list, total: list.length });
  });

  // 1. Create Organization
  fastify.post("/", async (request, reply) => {
    const parse = CreateOrganizationRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        error: "VALIDATION_FAILED",
        issues: parse.error.issues,
      });
    }

    try {
      const result = orgService.createOrganization(parse.data);
      return reply.status(201).send(result);
    } catch (err) {
      if (err instanceof MembershipConflictError) {
        return reply.status(409).send({
          error: "ORGANIZATION_SLUG_CONFLICT",
          message: err.message,
        });
      }
      throw err;
    }
  });

  // 2. Get Organization by ID
  fastify.get("/:orgId", async (request, reply) => {
    const { orgId } = request.params as { orgId: string };
    const org = orgService.getOrganizationById(orgId);
    if (!org) {
      return reply.status(404).send({
        error: "ORGANIZATION_NOT_FOUND",
        message: `Organization with id '${orgId}' not found`,
      });
    }
    return reply.status(200).send(org);
  });

  // 3. Resolve Organization by Slug
  fastify.get("/by-slug/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const org = orgService.getOrganizationBySlug(slug);
    if (!org) {
      return reply.status(404).send({
        error: "ORGANIZATION_NOT_FOUND",
        message: `Organization with slug '${slug}' not found`,
      });
    }
    return reply.status(200).send(org);
  });

  // 4. Invite / Add Member (Tenant & Role Guarded)
  fastify.post("/:orgId/members", async (request, reply) => {
    const { orgId } = request.params as { orgId: string };
    const parse = InviteMemberRequestSchema.safeParse(request.body);
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
            message: `Role '${auth.role}' is not authorized to add members`,
          });
        }
      }

      const member = orgService.inviteMember(orgId, parse.data);
      return reply.status(201).send(member);
    } catch (err) {
      if (isTenantOrAuthForbiddenError(err)) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err instanceof Error ? err.message : "Forbidden" });
      }
      if (err instanceof TenantNotFoundError) {
        return reply.status(404).send({ error: "ORGANIZATION_NOT_FOUND", message: err.message });
      }
      if (err instanceof MembershipConflictError) {
        return reply.status(409).send({ error: "MEMBER_ALREADY_EXISTS", message: err.message });
      }
      throw err;
    }
  });

  // 5. List Members (Tenant Guarded)
  fastify.get("/:orgId/members", async (request, reply) => {
    const { orgId } = request.params as { orgId: string };
    try {
      if (authService && request.headers.authorization) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, orgId);
        authService.assertCompanyMember(auth);
      }

      const members = orgService.listMembers(orgId);
      return reply.status(200).send({ members, total: members.length });
    } catch (err) {
      if (isTenantOrAuthForbiddenError(err)) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err instanceof Error ? err.message : "Forbidden" });
      }
      if (err instanceof TenantNotFoundError) {
        return reply.status(404).send({ error: "ORGANIZATION_NOT_FOUND", message: err.message });
      }
      throw err;
    }
  });

  // 6. Update Member Role (Tenant & Role Guarded)
  fastify.patch("/:orgId/members/:memberId", async (request, reply) => {
    const { orgId, memberId } = request.params as { orgId: string; memberId: string };
    const parse = UpdateMemberRoleRequestSchema.safeParse(request.body);
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
            message: `Role '${auth.role}' is not authorized to update member roles`,
          });
        }
      }

      const updated = orgService.updateMemberRole(orgId, memberId, parse.data.role);
      return reply.status(200).send(updated);
    } catch (err) {
      if (isTenantOrAuthForbiddenError(err)) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err instanceof Error ? err.message : "Forbidden" });
      }
      if (err instanceof TenantNotFoundError) {
        return reply.status(404).send({ error: "ORGANIZATION_NOT_FOUND", message: err.message });
      }
      if (err instanceof MemberNotFoundError) {
        return reply.status(404).send({ error: "MEMBER_NOT_FOUND", message: err.message });
      }
      if (err instanceof TenantOperationForbiddenError) {
        return reply.status(403).send({ error: "FORBIDDEN_OPERATION", message: err.message });
      }
      throw err;
    }
  });

  // 7. Remove Member (Tenant & Role Guarded)
  fastify.delete("/:orgId/members/:memberId", async (request, reply) => {
    const { orgId, memberId } = request.params as { orgId: string; memberId: string };
    try {
      if (authService && request.headers.authorization) {
        const auth = authService.parseAuthHeader(request.headers.authorization);
        authService.assertTenantAccess(auth, orgId);
        if (!["owner", "admin"].includes(auth.role)) {
          return reply.status(403).send({
            error: "FORBIDDEN",
            message: `Role '${auth.role}' is not authorized to remove members`,
          });
        }
      }

      orgService.removeMember(orgId, memberId);
      return reply.status(204).send();
    } catch (err) {
      if (isTenantOrAuthForbiddenError(err)) {
        return reply.status(403).send({ error: "FORBIDDEN", message: err instanceof Error ? err.message : "Forbidden" });
      }
      if (err instanceof TenantNotFoundError) {
        return reply.status(404).send({ error: "ORGANIZATION_NOT_FOUND", message: err.message });
      }
      if (err instanceof MemberNotFoundError) {
        return reply.status(404).send({ error: "MEMBER_NOT_FOUND", message: err.message });
      }
      if (err instanceof TenantOperationForbiddenError) {
        return reply.status(403).send({ error: "FORBIDDEN_OPERATION", message: err.message });
      }
      throw err;
    }
  });
};

