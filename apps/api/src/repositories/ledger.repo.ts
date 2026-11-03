import { eq, or, like } from "drizzle-orm";
import { getDb, type AppDatabase } from "../db/connection.js";
import { usageEvents } from "../db/schema.js";
import type { UsageEventRecord } from "@ai-copilot/contracts";

export class LedgerRepository {
  constructor(private dbProvider: () => Promise<AppDatabase> = getDb) {}

  public async record(event: UsageEventRecord): Promise<UsageEventRecord> {
    const db = await this.dbProvider();
    await db.insert(usageEvents).values({
      id: event.id,
      organizationId: event.userId ? event.userId.split(":")[0] ?? null : null,
      sessionId: event.userId && event.userId.includes(":") ? event.userId.split(":")[1] ?? null : null,
      userId: event.userId ?? null,
      provider: event.provider,
      model: event.model,
      operation: event.operation,
      inputUnits: event.inputUnits,
      outputUnits: event.outputUnits,
      estimatedCostUsd: event.estimatedCostUsd.toFixed(5),
      status: event.status,
      createdAt: event.createdAt,
    });
    return event;
  }

  public async listByOrg(orgId: string): Promise<UsageEventRecord[]> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(usageEvents)
      .where(
        or(
          eq(usageEvents.userId, orgId),
          like(usageEvents.userId, `${orgId}:%`)
        )
      );
    return rows.map((r) => this.mapUsage(r));
  }

  public async listAll(): Promise<UsageEventRecord[]> {
    const db = await this.dbProvider();
    const rows = await db.select().from(usageEvents);
    return rows.map((r) => this.mapUsage(r));
  }

  private mapUsage(row: typeof usageEvents.$inferSelect): UsageEventRecord {
    return {
      id: row.id,
      userId: row.userId ?? undefined,
      provider: row.provider,
      model: row.model,
      operation: row.operation as UsageEventRecord["operation"],
      inputUnits: row.inputUnits,
      outputUnits: row.outputUnits,
      estimatedCostUsd: Number(row.estimatedCostUsd),
      status: row.status as UsageEventRecord["status"],
      createdAt: new Date(row.createdAt),
    };
  }
}

