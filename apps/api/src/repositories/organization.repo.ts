import { eq, and } from "drizzle-orm";
import { getDb, type AppDatabase } from "../db/connection.js";
import { organizations, organizationMembers } from "../db/schema.js";
import type {
  Organization,
  OrganizationMember,
  MembershipRole,
} from "@ai-copilot/contracts";

export class OrganizationRepository {
  constructor(private dbProvider: () => Promise<AppDatabase> = getDb) {}

  public async create(
    org: Organization,
    ownerMember: OrganizationMember
  ): Promise<{ organization: Organization; ownerMember: OrganizationMember }> {
    const db = await this.dbProvider();

    // Use transaction for atomic organization + owner member creation
    return await db.transaction(async (tx) => {
      await tx.insert(organizations).values({
        id: org.id,
        slug: org.slug,
        name: org.name,
        plan: org.plan,
        settings: org.settings,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      });

      await tx.insert(organizationMembers).values({
        id: ownerMember.id,
        organizationId: ownerMember.organizationId,
        userId: ownerMember.userId,
        email: ownerMember.email,
        name: ownerMember.name,
        role: ownerMember.role,
        status: ownerMember.status,
        invitedByMemberId: ownerMember.invitedByMemberId,
        createdAt: ownerMember.createdAt,
        updatedAt: ownerMember.updatedAt,
      });

      return { organization: org, ownerMember };
    });
  }

  public async findById(id: string): Promise<Organization | null> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (rows.length === 0 || !rows[0]) return null;
    return this.mapOrganization(rows[0]);
  }

  public async findBySlug(slug: string): Promise<Organization | null> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug.toLowerCase().trim()))
      .limit(1);

    if (rows.length === 0 || !rows[0]) return null;
    return this.mapOrganization(rows[0]);
  }

  public async list(): Promise<Organization[]> {
    const db = await this.dbProvider();
    const rows = await db.select().from(organizations);
    return rows.map((r) => this.mapOrganization(r));
  }

  public async addMember(member: OrganizationMember): Promise<OrganizationMember> {
    const db = await this.dbProvider();
    await db.insert(organizationMembers).values({
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      email: member.email,
      name: member.name,
      role: member.role,
      status: member.status,
      invitedByMemberId: member.invitedByMemberId,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    });
    return member;
  }

  public async findMember(orgId: string, memberId: string): Promise<OrganizationMember | null> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.id, memberId)
        )
      )
      .limit(1);

    if (rows.length === 0 || !rows[0]) return null;
    return this.mapMember(rows[0]);
  }

  public async findMemberByEmail(orgId: string, email: string): Promise<OrganizationMember | null> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.email, email.toLowerCase().trim())
        )
      )
      .limit(1);

    if (rows.length === 0 || !rows[0]) return null;
    return this.mapMember(rows[0]);
  }

  public async listMembers(orgId: string): Promise<OrganizationMember[]> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, orgId));
    return rows.map((r) => this.mapMember(r));
  }

  public async updateMemberRole(
    orgId: string,
    memberId: string,
    role: MembershipRole
  ): Promise<OrganizationMember | null> {
    const db = await this.dbProvider();
    const now = new Date();
    const rows = await db
      .update(organizationMembers)
      .set({ role, updatedAt: now })
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.id, memberId)
        )
      )
      .returning();

    if (rows.length === 0 || !rows[0]) return null;
    return this.mapMember(rows[0]);
  }

  private mapOrganization(row: typeof organizations.$inferSelect): Organization {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      plan: row.plan as Organization["plan"],
      settings: row.settings as Organization["settings"],
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapMember(row: typeof organizationMembers.$inferSelect): OrganizationMember {
    return {
      id: row.id,
      organizationId: row.organizationId,
      userId: row.userId,
      email: row.email,
      name: row.name,
      role: row.role as MembershipRole,
      status: row.status as OrganizationMember["status"],
      invitedByMemberId: row.invitedByMemberId ?? undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}

