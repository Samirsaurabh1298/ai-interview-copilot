import { eq, desc } from "drizzle-orm";
import { getDb, type AppDatabase } from "../db/connection.js";
import { proctorIncidents } from "../db/schema.js";
import type { IntegrityIncident } from "@ai-copilot/contracts";

export class ProctorIncidentRepository {
  constructor(private dbProvider: () => Promise<AppDatabase> = getDb) {}

  public async create(incident: IntegrityIncident): Promise<IntegrityIncident> {
    const db = await this.dbProvider();
    await db.insert(proctorIncidents).values({
      id: incident.id,
      sessionId: incident.sessionId,
      organizationId: incident.organizationId,
      severity: incident.severity,
      category: incident.category,
      description: incident.description,
      proctorName: incident.proctorName ?? null,
      metadata: incident.metadata ?? {},
      isResolved: incident.isResolved ?? false,
      createdAt: incident.createdAt,
    });
    return incident;
  }

  public async listBySessionId(sessionId: string): Promise<IntegrityIncident[]> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(proctorIncidents)
      .where(eq(proctorIncidents.sessionId, sessionId))
      .orderBy(desc(proctorIncidents.createdAt));
    return rows.map((r) => this.mapIncident(r));
  }

  public async listByOrg(orgId: string): Promise<IntegrityIncident[]> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(proctorIncidents)
      .where(eq(proctorIncidents.organizationId, orgId))
      .orderBy(desc(proctorIncidents.createdAt));
    return rows.map((r) => this.mapIncident(r));
  }

  public async resolve(incidentId: string): Promise<IntegrityIncident | null> {
    const db = await this.dbProvider();
    const updated = await db
      .update(proctorIncidents)
      .set({ isResolved: true })
      .where(eq(proctorIncidents.id, incidentId))
      .returning();
    if (updated.length === 0 || !updated[0]) return null;
    return this.mapIncident(updated[0]);
  }

  private mapIncident(row: typeof proctorIncidents.$inferSelect): IntegrityIncident {
    return {
      id: row.id,
      sessionId: row.sessionId,
      organizationId: row.organizationId,
      severity: row.severity as IntegrityIncident["severity"],
      category: row.category as IntegrityIncident["category"],
      description: row.description,
      proctorName: row.proctorName ?? undefined,
      metadata: (row.metadata as Record<string, unknown>) ?? undefined,
      isResolved: row.isResolved,
      createdAt: new Date(row.createdAt),
    };
  }
}

