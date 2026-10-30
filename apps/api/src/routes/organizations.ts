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

export const organizationsRoutes: FastifyPluginAsync<{
  orgService: OrganizationService;
}> = async (fastify, opts) => {
  const { orgService } = opts;

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

  // 4. Invite / Add Member
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
      const member = orgService.inviteMember(orgId, parse.data);
      return reply.status(201).send(member);
    } catch (err) {
      if (err instanceof TenantNotFoundError) {
        return reply.status(404).send({ error: "ORGANIZATION_NOT_FOUND", message: err.message });
      }
      if (err instanceof MembershipConflictError) {
        return reply.status(409).send({ error: "MEMBER_ALREADY_EXISTS", message: err.message });
      }
      throw err;
    }
  });

  // 5. List Members
  fastify.get("/:orgId/members", async (request, reply) => {
    const { orgId } = request.params as { orgId: string };
    try {
      const members = orgService.listMembers(orgId);
      return reply.status(200).send({ members, total: members.length });
    } catch (err) {
      if (err instanceof TenantNotFoundError) {
        return reply.status(404).send({ error: "ORGANIZATION_NOT_FOUND", message: err.message });
      }
      throw err;
    }
  });

  // 6. Update Member Role
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
      const updated = orgService.updateMemberRole(orgId, memberId, parse.data.role);
      return reply.status(200).send(updated);
    } catch (err) {
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

  // 7. Remove Member
  fastify.delete("/:orgId/members/:memberId", async (request, reply) => {
    const { orgId, memberId } = request.params as { orgId: string; memberId: string };
    try {
      orgService.removeMember(orgId, memberId);
      return reply.status(204).send();
    } catch (err) {
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
