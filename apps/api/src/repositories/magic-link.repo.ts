import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { getDb, type AppDatabase } from "../db/connection.js";
import { authRateLimits, magicLinkTokens } from "../db/schema.js";

export interface MagicLinkRecord {
  tokenHash: string;
  memberId: string;
  organizationId: string;
  email: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export type ConsumeMagicLinkResult =
  | { status: "consumed"; record: MagicLinkRecord }
  | { status: "not_found" }
  | { status: "already_used" }
  | { status: "expired" };

export class MagicLinkRepository {
  constructor(private dbProvider: () => Promise<AppDatabase> = getDb) {}

  public async createToken(params: {
    tokenHash: string;
    memberId: string;
    organizationId: string;
    email: string;
    ttlSeconds: number;
  }): Promise<MagicLinkRecord> {
    const db = await this.dbProvider();
    const ttlSecs = Math.max(1, Math.floor(params.ttlSeconds));

    const rows = await db
      .insert(magicLinkTokens)
      .values({
        tokenHash: params.tokenHash,
        memberId: params.memberId,
        orgId: params.organizationId,
        email: params.email,
        expiresAt: sql`clock_timestamp() + (${ttlSecs} * interval '1 second')`,
        usedAt: null,
        createdAt: sql`clock_timestamp()`,
      })
      .returning();

    const row = rows[0]!;
    return this.mapRecord(row);
  }

  /**
   * Atomically consumes a valid unused magic-link token using PostgreSQL clock_timestamp().
   * Only one concurrent caller can claim a tokenHash.
   */
  public async consumeTokenAtomically(tokenHash: string): Promise<ConsumeMagicLinkResult> {
    const db = await this.dbProvider();

    const updated = await db
      .update(magicLinkTokens)
      .set({ usedAt: sql`clock_timestamp()` })
      .where(
        and(
          eq(magicLinkTokens.tokenHash, tokenHash),
          isNull(magicLinkTokens.usedAt),
          gt(magicLinkTokens.expiresAt, sql`clock_timestamp()`)
        )
      )
      .returning();

    if (updated.length > 0 && updated[0]) {
      return {
        status: "consumed",
        record: this.mapRecord(updated[0]),
      };
    }

    // Disambiguate failure reason without mutating consumed tokens
    const existing = await db
      .select({
        usedAt: magicLinkTokens.usedAt,
        expiresAt: magicLinkTokens.expiresAt,
      })
      .from(magicLinkTokens)
      .where(eq(magicLinkTokens.tokenHash, tokenHash))
      .limit(1);

    const row = existing[0];
    if (!row) {
      return { status: "not_found" };
    }
    if (row.usedAt !== null) {
      return { status: "already_used" };
    }
    return { status: "expired" };
  }

  public async revokeAllForMember(memberId: string): Promise<void> {
    const db = await this.dbProvider();
    await db
      .update(magicLinkTokens)
      .set({ usedAt: sql`clock_timestamp()` })
      .where(and(eq(magicLinkTokens.memberId, memberId), isNull(magicLinkTokens.usedAt)));
  }

  /**
   * Atomically enforces persistent fixed-window rate limiting in SQL.
   * Safe across process restarts and multiple API replicas.
   */
  public async incrementAndCheckRateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; requestCount: number; windowStart: Date }> {
    const db = await this.dbProvider();
    const winSecs = Math.max(1, Math.floor(windowSeconds));

    const rows = await db
      .insert(authRateLimits)
      .values({
        key,
        windowStart: sql`clock_timestamp()`,
        requestCount: 1,
        updatedAt: sql`clock_timestamp()`,
      })
      .onConflictDoUpdate({
        target: authRateLimits.key,
        set: {
          requestCount: sql`CASE WHEN ${authRateLimits.windowStart} + (${winSecs} * interval '1 second') <= clock_timestamp() THEN 1 ELSE ${authRateLimits.requestCount} + 1 END`,
          windowStart: sql`CASE WHEN ${authRateLimits.windowStart} + (${winSecs} * interval '1 second') <= clock_timestamp() THEN clock_timestamp() ELSE ${authRateLimits.windowStart} END`,
          updatedAt: sql`clock_timestamp()`,
        },
      })
      .returning();

    const row = rows[0]!;
    return {
      allowed: row.requestCount <= maxRequests,
      requestCount: row.requestCount,
      windowStart: new Date(row.windowStart),
    };
  }

  private mapRecord(row: typeof magicLinkTokens.$inferSelect): MagicLinkRecord {
    return {
      tokenHash: row.tokenHash,
      memberId: row.memberId,
      organizationId: row.orgId,
      email: row.email,
      expiresAt: new Date(row.expiresAt),
      usedAt: row.usedAt ? new Date(row.usedAt) : null,
      createdAt: new Date(row.createdAt),
    };
  }
}
