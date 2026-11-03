import { eq, asc } from "drizzle-orm";
import { getDb, type AppDatabase } from "../db/connection.js";
import { sessionEvents } from "../db/schema.js";
import type { SessionEvent } from "@ai-copilot/contracts";

export class SessionEventsRepository {
  constructor(private dbProvider: () => Promise<AppDatabase> = getDb) {}

  public async insertBatch(events: SessionEvent[]): Promise<number> {
    if (events.length === 0) return 0;
    const db = await this.dbProvider();

    const values = events.map((e) => ({
      id: e.id,
      sessionId: e.sessionId,
      sequenceNumber: e.sequenceNumber,
      type: e.type,
      timestamp: e.timestamp,
      payload: e.payload,
    }));

    await db.insert(sessionEvents).values(values).onConflictDoNothing();
    return events.length;
  }

  public async listBySession(sessionId: string): Promise<SessionEvent[]> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(sessionEvents)
      .where(eq(sessionEvents.sessionId, sessionId))
      .orderBy(asc(sessionEvents.sequenceNumber));

    return rows.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      sequenceNumber: r.sequenceNumber,
      type: r.type as SessionEvent["type"],
      timestamp: new Date(r.timestamp),
      payload: r.payload as SessionEvent["payload"],
    }));
  }
}

