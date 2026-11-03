import { eq } from "drizzle-orm";
import { getDb, type AppDatabase } from "../db/connection.js";
import { webhookSubscriptions } from "../db/schema.js";
import type { WebhookSubscription } from "@ai-copilot/contracts";

export class WebhookRepository {
  constructor(private dbProvider: () => Promise<AppDatabase> = getDb) {}

  public async create(subscription: WebhookSubscription): Promise<WebhookSubscription> {
    const db = await this.dbProvider();
    await db.insert(webhookSubscriptions).values({
      id: subscription.id,
      organizationId: subscription.organizationId,
      targetUrl: subscription.targetUrl,
      secret: subscription.secret,
      eventTypes: subscription.eventTypes,
      format: subscription.format,
      status: subscription.status,
      failureCount: subscription.failureCount,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    });
    return subscription;
  }

  public async findById(id: string): Promise<WebhookSubscription | null> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.id, id))
      .limit(1);

    if (rows.length === 0 || !rows[0]) return null;
    return this.mapWebhook(rows[0]);
  }

  public async listByOrg(orgId: string): Promise<WebhookSubscription[]> {
    const db = await this.dbProvider();
    const rows = await db
      .select()
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.organizationId, orgId));
    return rows.map((r) => this.mapWebhook(r));
  }

  public async update(
    id: string,
    patch: Partial<WebhookSubscription>
  ): Promise<WebhookSubscription | null> {
    const db = await this.dbProvider();
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (patch.status !== undefined) updateValues.status = patch.status;
    if (patch.failureCount !== undefined) updateValues.failureCount = patch.failureCount;

    const rows = await db
      .update(webhookSubscriptions)
      .set(updateValues)
      .where(eq(webhookSubscriptions.id, id))
      .returning();

    if (rows.length === 0 || !rows[0]) return null;
    return this.mapWebhook(rows[0]);
  }

  public async delete(id: string): Promise<boolean> {
    const db = await this.dbProvider();
    const rows = await db
      .delete(webhookSubscriptions)
      .where(eq(webhookSubscriptions.id, id))
      .returning();
    return rows.length > 0;
  }

  private mapWebhook(row: typeof webhookSubscriptions.$inferSelect): WebhookSubscription {
    return {
      id: row.id,
      organizationId: row.organizationId,
      targetUrl: row.targetUrl,
      secret: row.secret,
      eventTypes: row.eventTypes as WebhookSubscription["eventTypes"],
      format: row.format as WebhookSubscription["format"],
      status: row.status as WebhookSubscription["status"],
      failureCount: row.failureCount,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}

