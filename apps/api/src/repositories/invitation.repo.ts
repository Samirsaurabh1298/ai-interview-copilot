import { eq, and } from "drizzle-orm";
import { getDb, type AppDatabase } from "../db/connection.js";
import { candidateInvitations } from "../db/schema.js";
import type { CandidateInvitation } from "@ai-copilot/contracts";

export class InvitationRepository {
  constructor(private dbProvider: () => Promise<AppDatabase> = getDb) {}

  public async create(invitation: CandidateInvitation): Promise<CandidateInvitation> {
    const db = await this.dbProvider();
    await db.insert(candidateInvitations).values({
      id: invitation.id,
      organizationId: invitation.organizationId,
      templateId: invitation.templateId,
      versionId: invitation.versionId ?? null,
      candidateEmail: invitation.candidateEmail,
      candidateName: invitation.candidateName,
      invitationToken: invitation.invitationToken,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      sessionId: invitation.sessionId ?? null,
      invitedByMemberId: invitation.invitedByMemberId ?? null,
      createdAt: invitation.createdAt,
      acceptedAt: invitation.acceptedAt ?? null,
      startedAt: invitation.startedAt ?? null,
    });
    return invitation;
  }

  public async findById(id: string): Promise<CandidateInvitation | null> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(candidateInvitations)
      .where(eq(candidateInvitations.id, id))
      .limit(1);

    if (rows.length === 0 || !rows[0]) return null;
    return this.mapInvitation(rows[0]);
  }

  public async findByToken(token: string): Promise<CandidateInvitation | null> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(candidateInvitations)
      .where(eq(candidateInvitations.invitationToken, token))
      .limit(1);

    if (rows.length === 0 || !rows[0]) return null;
    return this.mapInvitation(rows[0]);
  }

  public async listByOrg(orgId: string): Promise<CandidateInvitation[]> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(candidateInvitations)
      .where(eq(candidateInvitations.organizationId, orgId));
    return rows.map((r) => this.mapInvitation(r));
  }

  public async update(
    id: string,
    patch: Partial<CandidateInvitation>
  ): Promise<CandidateInvitation | null> {
    const db = await this.dbProvider();
    const updateValues: Record<string, unknown> = {};

    if (patch.status !== undefined) updateValues.status = patch.status;
    if (patch.sessionId !== undefined) updateValues.sessionId = patch.sessionId;
    if (patch.acceptedAt !== undefined) updateValues.acceptedAt = patch.acceptedAt;
    if (patch.startedAt !== undefined) updateValues.startedAt = patch.startedAt;

    const rows = await db
      .update(candidateInvitations)
      .set(updateValues)
      .where(eq(candidateInvitations.id, id))
      .returning();

    if (rows.length === 0 || !rows[0]) return null;
    return this.mapInvitation(rows[0]);
  }

  private mapInvitation(row: typeof candidateInvitations.$inferSelect): CandidateInvitation {
    return {
      id: row.id,
      organizationId: row.organizationId,
      templateId: row.templateId,
      versionId: row.versionId ?? undefined,
      candidateEmail: row.candidateEmail,
      candidateName: row.candidateName,
      invitationToken: row.invitationToken,
      status: row.status as CandidateInvitation["status"],
      expiresAt: new Date(row.expiresAt),
      sessionId: row.sessionId ?? undefined,
      invitedByMemberId: row.invitedByMemberId ?? undefined,
      createdAt: new Date(row.createdAt),
      acceptedAt: row.acceptedAt ? new Date(row.acceptedAt) : undefined,
      startedAt: row.startedAt ? new Date(row.startedAt) : undefined,
    };
  }
}

