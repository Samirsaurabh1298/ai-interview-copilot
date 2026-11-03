import crypto from "node:crypto";
import type {
  WebhookEventType,
  WebhookFormat,
  WebhookSubscription,
  WebhookSubscriptionStatus,
  CreateWebhookSubscriptionRequest,
  WebhookDeliveryLog,
  WebhookEventPayload,
} from "@ai-copilot/contracts";
import type { OrganizationService } from "./organization.js";
import { WebhookRepository } from "../repositories/webhook.repo.js";

export class WebhookSubscriptionNotFoundError extends Error {
  constructor(message = "Webhook subscription not found") {
    super(message);
    this.name = "WebhookSubscriptionNotFoundError";
    Object.setPrototypeOf(this, WebhookSubscriptionNotFoundError.prototype);
  }
}

export class WebhookService {
  // Key: subscriptionId -> WebhookSubscription
  private subscriptionsById = new Map<string, WebhookSubscription>();
  // Key: orgId -> Set<subscriptionId>
  private subscriptionsByOrg = new Map<string, Set<string>>();
  // In-memory bounded audit log of recent deliveries
  private deliveryLogs: WebhookDeliveryLog[] = [];
  private readonly maxLogs = 500;
  private repo: WebhookRepository;

  constructor(
    private orgService?: OrganizationService,
    repo?: WebhookRepository
  ) {
    this.repo = repo ?? new WebhookRepository();
  }

  public async loadFromDatabase(orgId?: string): Promise<void> {
    try {
      if (orgId) {
        const subs = await this.repo.listByOrg(orgId);
        let set = this.subscriptionsByOrg.get(orgId);
        if (!set) {
          set = new Set();
          this.subscriptionsByOrg.set(orgId, set);
        }
        for (const s of subs) {
          this.subscriptionsById.set(s.id, s);
          set.add(s.id);
        }
      }
    } catch (err) {
      console.error("[WebhookService] Failed to load from database:", err);
    }
  }

  // ==============================================================================
  // Subscription CRUD
  // ==============================================================================

  public createSubscription(req: CreateWebhookSubscriptionRequest): WebhookSubscription {
    if (this.orgService) {
      const org = this.orgService.getOrganizationById(req.organizationId);
      if (!org) {
        throw new Error(`Organization '${req.organizationId}' does not exist`);
      }
    }

    const id = "wh_sub_" + crypto.randomBytes(6).toString("hex") + "_" + Date.now();
    const secret = req.secret ?? crypto.randomBytes(24).toString("hex");
    const now = new Date();

    const subscription: WebhookSubscription = {
      id,
      organizationId: req.organizationId,
      targetUrl: req.targetUrl,
      secret,
      eventTypes: req.eventTypes,
      format: req.format ?? "standard",
      status: "active",
      failureCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.subscriptionsById.set(id, subscription);

    if (!this.subscriptionsByOrg.has(req.organizationId)) {
      this.subscriptionsByOrg.set(req.organizationId, new Set());
    }
    this.subscriptionsByOrg.get(req.organizationId)!.add(id);

    // Durable write-through to PostgreSQL
    this.repo.create(subscription).catch((err) => {
      console.error("[WebhookService] DB subscription create error:", err);
    });

    return subscription;
  }

  public listSubscriptions(orgId: string): WebhookSubscription[] {
    const subIds = this.subscriptionsByOrg.get(orgId);
    if (!subIds) return [];

    const subs: WebhookSubscription[] = [];
    for (const id of subIds) {
      const sub = this.subscriptionsById.get(id);
      if (sub) {
        subs.push(sub);
      }
    }
    return subs;
  }

  public getSubscription(orgId: string, subscriptionId: string): WebhookSubscription | undefined {
    const sub = this.subscriptionsById.get(subscriptionId);
    if (!sub || sub.organizationId !== orgId) {
      return undefined;
    }
    return sub;
  }

  public deleteSubscription(orgId: string, subscriptionId: string): boolean {
    const sub = this.subscriptionsById.get(subscriptionId);
    if (!sub || sub.organizationId !== orgId) {
      return false;
    }

    this.subscriptionsById.delete(subscriptionId);
    this.subscriptionsByOrg.get(orgId)?.delete(subscriptionId);

    // Durable delete in PostgreSQL
    this.repo.delete(subscriptionId).catch((err) => {
      console.error("[WebhookService] DB subscription delete error:", err);
    });

    return true;
  }

  public updateSubscriptionStatus(
    subscriptionId: string,
    status: WebhookSubscriptionStatus
  ): WebhookSubscription {
    const sub = this.subscriptionsById.get(subscriptionId);
    if (!sub) {
      throw new WebhookSubscriptionNotFoundError(`Subscription '${subscriptionId}' not found`);
    }

    sub.status = status;
    sub.updatedAt = new Date();
    return sub;
  }

  // ==============================================================================
  // HMAC-SHA256 Cryptographic Signature & Verification
  // ==============================================================================

  public static signPayload(secret: string, timestamp: number, payloadString: string): string {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(`${timestamp}.${payloadString}`);
    return hmac.digest("hex");
  }

  public static verifySignature(
    secret: string,
    timestamp: number | string,
    payloadString: string,
    headerSignature: string,
    maxToleranceMs = 300_000 // 5 minutes anti-replay window
  ): boolean {
    const numericTimestamp = typeof timestamp === "string" ? parseInt(timestamp, 10) : timestamp;
    if (isNaN(numericTimestamp)) return false;

    // Reject replays older than tolerance
    const now = Date.now();
    if (Math.abs(now - numericTimestamp) > maxToleranceMs) {
      return false;
    }

    const expectedSig = WebhookService.signPayload(secret, numericTimestamp, payloadString);

    const providedSig = headerSignature.startsWith("sha256=")
      ? headerSignature.slice(7)
      : headerSignature;

    const providedBuf = Buffer.from(providedSig, "utf8");
    const expectedBuf = Buffer.from(expectedSig, "utf8");

    if (providedBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(providedBuf, expectedBuf);
  }

  // ==============================================================================
  // ATS Payload Adapters
  // ==============================================================================

  public formatPayload(format: WebhookFormat, event: WebhookEventPayload): unknown {
    switch (format) {
      case "greenhouse":
        return {
          action: "assessment_partner_update",
          partner_test_id: event.data.sessionId ?? event.eventId,
          candidate_id: event.data.candidateEmail ?? event.data.candidateId ?? "unknown",
          status:
            event.eventType === "session.submitted" || event.eventType === "report.finalized"
              ? "complete"
              : event.eventType === "session.expired"
                ? "expired"
                : "in_progress",
          score: event.data.overallScore ?? (event.data.report as any)?.consensusScore ?? null,
          results_url:
            (event.data.reportUrl as string) ??
            (event.data.report as any)?.reportUrl ??
            `https://app.interview-copilot.internal/sessions/${event.data.sessionId}/report`,
          metadata: {
            eventId: event.eventId,
            eventType: event.eventType,
            organizationId: event.organizationId,
            recommendation: event.data.overallRecommendation ?? (event.data.report as any)?.recommendation,
            timestamp: event.timestamp,
          },
        };

      case "lever":
        return {
          opportunityId: event.data.candidateEmail ?? event.data.candidateId ?? "unknown",
          stage: "Technical Assessment",
          assessment: {
            sessionId: event.data.sessionId,
            eventType: event.eventType,
            recommendation: event.data.overallRecommendation ?? (event.data.report as any)?.recommendation ?? "pending",
            score: event.data.overallScore ?? (event.data.report as any)?.consensusScore ?? null,
            reportUrl:
              (event.data.reportUrl as string) ??
              (event.data.report as any)?.reportUrl ??
              `https://app.interview-copilot.internal/sessions/${event.data.sessionId}/report`,
            completedAt: event.timestamp,
          },
        };

      case "workday":
        return {
          workdayEvent: "ThirdPartyAssessmentResult",
          applicantId: event.data.candidateEmail ?? event.data.candidateId ?? "unknown",
          assessmentReference: {
            system: "AI-Interview-Copilot",
            sessionId: event.data.sessionId,
            status: event.eventType,
          },
          scorecard: {
            overallRating: event.data.overallRecommendation ?? (event.data.report as any)?.recommendation,
            percentScore: event.data.overallScore ?? (event.data.report as any)?.consensusScore,
            evaluatedAt: event.timestamp,
          },
        };

      case "standard":
      default:
        return {
          eventId: event.eventId,
          eventType: event.eventType,
          timestamp: event.timestamp,
          organizationId: event.organizationId,
          data: event.data,
        };
    }
  }

  // ==============================================================================
  // Event Dispatcher & Delivery Engine
  // ==============================================================================

  public async dispatch(
    event: WebhookEventPayload,
    fetchFn: typeof fetch = fetch
  ): Promise<WebhookDeliveryLog[]> {
    const subscriptions = this.listSubscriptions(event.organizationId).filter(
      (sub) => sub.status !== "disabled" && (sub.eventTypes.includes(event.eventType) || sub.eventTypes.includes("*" as any))
    );

    const deliveryPromises = subscriptions.map((sub) =>
      this.deliverToSubscription(sub, event, fetchFn)
    );

    return Promise.all(deliveryPromises);
  }

  private async deliverToSubscription(
    subscription: WebhookSubscription,
    event: WebhookEventPayload,
    fetchFn: typeof fetch
  ): Promise<WebhookDeliveryLog> {
    const deliveryId = "wh_del_" + crypto.randomBytes(6).toString("hex") + "_" + Date.now();
    const formattedPayload = this.formatPayload(subscription.format, event);
    const payloadString = JSON.stringify(formattedPayload);
    const timestamp = Date.now();
    const signature = WebhookService.signPayload(subscription.secret, timestamp, payloadString);

    let attemptCount = 0;
    const maxAttempts = 3;
    let lastError: string | undefined;
    let statusCode: number | undefined;
    let responseBody: string | undefined;
    let success = false;
    const startTime = Date.now();

    while (attemptCount < maxAttempts && !success) {
      attemptCount++;
      try {
        const response = await fetchFn(subscription.targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": `sha256=${signature}`,
            "X-Webhook-Timestamp": timestamp.toString(),
            "X-Webhook-Event": event.eventType,
            "X-Webhook-Id": event.eventId,
            "User-Agent": "AI-Interview-Copilot-Webhook-Dispatcher/1.0",
          },
          body: payloadString,
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        statusCode = response.status;
        try {
          responseBody = await response.text();
        } catch {
          responseBody = "";
        }

        if (response.ok) {
          success = true;
          subscription.failureCount = 0;
          subscription.status = "active";
        } else {
          lastError = `Target endpoint returned HTTP ${response.status}`;
          // Don't retry on 4xx client errors (bad endpoint config)
          if (response.status >= 400 && response.status < 500) {
            break;
          }
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : "Network dispatch failure";
      }

      // Small backoff between retries if continuing
      if (!success && attemptCount < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 50 * attemptCount));
      }
    }

    const durationMs = Date.now() - startTime;

    if (!success) {
      subscription.failureCount += 1;
      if (subscription.failureCount >= 5) {
        subscription.status = "failing";
      }
    }

    const log: WebhookDeliveryLog = {
      id: deliveryId,
      subscriptionId: subscription.id,
      organizationId: subscription.organizationId,
      eventType: event.eventType,
      targetUrl: subscription.targetUrl,
      format: subscription.format,
      attemptCount,
      statusCode,
      success,
      error: lastError,
      durationMs,
      timestamp: new Date(timestamp),
      requestPayload: formattedPayload,
      responseBody,
    };

    // Store in ring buffer
    this.deliveryLogs.unshift(log);
    if (this.deliveryLogs.length > this.maxLogs) {
      this.deliveryLogs.length = this.maxLogs;
    }

    return log;
  }

  public listDeliveryLogs(orgId: string, subscriptionId?: string): WebhookDeliveryLog[] {
    return this.deliveryLogs.filter((log) => {
      if (log.organizationId !== orgId) return false;
      if (subscriptionId && log.subscriptionId !== subscriptionId) return false;
      return true;
    });
  }
}
