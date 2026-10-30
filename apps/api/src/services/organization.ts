import type {
  Organization,
  OrganizationMember,
  CreateOrganizationRequest,
  InviteMemberRequest,
  MembershipRole,
} from "@ai-copilot/contracts";

export class TenantNotFoundError extends Error {
  constructor(message = "Organization not found") {
    super(message);
    this.name = "TenantNotFoundError";
  }
}

export class MembershipConflictError extends Error {
  constructor(message = "Member with this email already belongs to the organization") {
    super(message);
    this.name = "MembershipConflictError";
  }
}

export class MemberNotFoundError extends Error {
  constructor(message = "Member not found in organization") {
    super(message);
    this.name = "MemberNotFoundError";
  }
}

export class TenantOperationForbiddenError extends Error {
  constructor(message = "Operation forbidden: cannot remove or demote the sole organization owner") {
    super(message);
    this.name = "TenantOperationForbiddenError";
  }
}

export class OrganizationService {
  private organizations = new Map<string, Organization>();
  private orgIdBySlug = new Map<string, string>();
  // Key: orgId -> Map<memberId, OrganizationMember>
  private membersByOrg = new Map<string, Map<string, OrganizationMember>>();

  public createOrganization(req: CreateOrganizationRequest): {
    organization: Organization;
    ownerMember: OrganizationMember;
  } {
    const slug = req.slug ?? this.generateSlug(req.name);

    if (this.orgIdBySlug.has(slug)) {
      throw new MembershipConflictError(`Organization slug '${slug}' is already taken`);
    }

    const orgId = "org_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();
    const ownerMemberId = "mem_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();
    const ownerUserId = "usr_" + Math.random().toString(36).substring(2, 9);

    const now = new Date();
    const organization: Organization = {
      id: orgId,
      slug,
      name: req.name.trim(),
      plan: req.plan ?? "pilot",
      settings: {
        defaultAiBudgetUsd: 0.25,
        enforcePatchReview: true,
        allowedProviders: ["openai", "groq"],
        maxConcurrentSessions: 10,
      },
      createdAt: now,
      updatedAt: now,
    };

    const ownerMember: OrganizationMember = {
      id: ownerMemberId,
      organizationId: orgId,
      userId: ownerUserId,
      email: req.ownerEmail.toLowerCase().trim(),
      name: req.ownerName.trim(),
      role: "owner",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    this.organizations.set(orgId, organization);
    this.orgIdBySlug.set(slug, orgId);

    const orgMembers = new Map<string, OrganizationMember>();
    orgMembers.set(ownerMemberId, ownerMember);
    this.membersByOrg.set(orgId, orgMembers);

    return { organization, ownerMember };
  }

  public getOrganizationById(orgId: string): Organization | undefined {
    return this.organizations.get(orgId);
  }

  public getOrganizationBySlug(slug: string): Organization | undefined {
    const orgId = this.orgIdBySlug.get(slug.toLowerCase().trim());
    if (!orgId) return undefined;
    return this.organizations.get(orgId);
  }

  public listOrganizations(): Organization[] {
    return Array.from(this.organizations.values());
  }

  public inviteMember(
    orgId: string,
    req: InviteMemberRequest,
    invitedByMemberId?: string
  ): OrganizationMember {
    const org = this.organizations.get(orgId);
    if (!org) {
      throw new TenantNotFoundError(`Organization '${orgId}' does not exist`);
    }

    const normalizedEmail = req.email.toLowerCase().trim();
    const orgMembers = this.membersByOrg.get(orgId) ?? new Map();

    for (const existing of orgMembers.values()) {
      if (existing.email.toLowerCase() === normalizedEmail) {
        throw new MembershipConflictError(
          `Member with email '${normalizedEmail}' already belongs to organization '${org.name}'`
        );
      }
    }

    const memberId = "mem_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();
    const userId = "usr_" + Math.random().toString(36).substring(2, 9);
    const now = new Date();

    const member: OrganizationMember = {
      id: memberId,
      organizationId: orgId,
      userId,
      email: normalizedEmail,
      name: req.name.trim(),
      role: req.role,
      status: "active",
      invitedByMemberId,
      createdAt: now,
      updatedAt: now,
    };

    orgMembers.set(memberId, member);
    this.membersByOrg.set(orgId, orgMembers);
    return member;
  }

  public listMembers(orgId: string): OrganizationMember[] {
    const org = this.organizations.get(orgId);
    if (!org) {
      throw new TenantNotFoundError(`Organization '${orgId}' does not exist`);
    }
    const orgMembers = this.membersByOrg.get(orgId);
    return orgMembers ? Array.from(orgMembers.values()) : [];
  }

  public getMemberById(orgId: string, memberId: string): OrganizationMember | undefined {
    const orgMembers = this.membersByOrg.get(orgId);
    return orgMembers?.get(memberId);
  }

  public updateMemberRole(
    orgId: string,
    memberId: string,
    newRole: MembershipRole
  ): OrganizationMember {
    const org = this.organizations.get(orgId);
    if (!org) {
      throw new TenantNotFoundError(`Organization '${orgId}' does not exist`);
    }

    const orgMembers = this.membersByOrg.get(orgId);
    const member = orgMembers?.get(memberId);
    if (!member) {
      throw new MemberNotFoundError(`Member '${memberId}' not found in organization '${orgId}'`);
    }

    // Safety check: Prevent demoting the last owner
    if (member.role === "owner" && newRole !== "owner") {
      const ownerCount = Array.from(orgMembers.values()).filter((m) => m.role === "owner").length;
      if (ownerCount <= 1) {
        throw new TenantOperationForbiddenError(
          "Cannot demote the sole remaining owner of an organization"
        );
      }
    }

    member.role = newRole;
    member.updatedAt = new Date();
    return member;
  }

  public removeMember(orgId: string, memberId: string): void {
    const org = this.organizations.get(orgId);
    if (!org) {
      throw new TenantNotFoundError(`Organization '${orgId}' does not exist`);
    }

    const orgMembers = this.membersByOrg.get(orgId);
    const member = orgMembers?.get(memberId);
    if (!member) {
      throw new MemberNotFoundError(`Member '${memberId}' not found in organization '${orgId}'`);
    }

    // Safety check: Prevent removing the last owner
    if (member.role === "owner") {
      const ownerCount = Array.from(orgMembers.values()).filter((m) => m.role === "owner").length;
      if (ownerCount <= 1) {
        throw new TenantOperationForbiddenError(
          "Cannot remove the sole remaining owner of an organization"
        );
      }
    }

    orgMembers.delete(memberId);
  }

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return base || "org-" + Math.random().toString(36).substring(2, 6);
  }
}
