import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { AuthService } from "../services/auth.js";
import { WebhookService } from "../services/webhook.js";
import type { WebhookEventPayload } from "@ai-copilot/contracts";

describe("Enterprise ATS / HRIS Webhook Dispatcher (Task 19)", () => {
  let app: FastifyInstance;
  let authService: AuthService;
  const jwtSecret = "super-secure-production-grade-jwt-secret-key-32-bytes";

  let orgAlphaId: string;
  let tokenAlphaAdmin: string;
  let tokenAlphaInterviewer: string;

  let orgBetaId: string;
  let tokenBetaAdmin: string;

  beforeAll(async () => {
    authService = new AuthService(jwtSecret);

    app = await buildApp({
      PORT: 0,
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      CORS_ORIGIN: "*",
      LOG_LEVEL: "silent",
      ANTHROPIC_API_KEY: undefined,
      GOOGLE_GENERATIVE_AI_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
      GROQ_API_KEY: undefined,
      DEFAULT_AI_PROVIDER: "mock",
      JWT_SECRET: jwtSecret,
    });

    await app.ready();

    // Setup Tenant Alpha
    const orgAlphaRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Acme Webhook Corp",
        slug: "acme-wh-corp",
        ownerEmail: "owner@acme-wh.com",
        ownerName: "Acme Owner",
        plan: "enterprise",
      },
    });
    orgAlphaId = orgAlphaRes.json().organization.id;

    tokenAlphaAdmin = authService.createMemberToken({
      id: "mem-wh-admin",
      organizationId: orgAlphaId,
      userId: "usr-wh-admin",
      email: "admin@acme-wh.com",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).token;

    tokenAlphaInterviewer = authService.createMemberToken({
      id: "mem-wh-interviewer",
      organizationId: orgAlphaId,
      userId: "usr-wh-interviewer",
      email: "interviewer@acme-wh.com",
      role: "interviewer",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).token;

    // Setup Tenant Beta
    const orgBetaRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Beta Webhook Corp",
        slug: "beta-wh-corp",
        ownerEmail: "owner@beta-wh.com",
        ownerName: "Beta Owner",
        plan: "enterprise",
      },
    });
    orgBetaId = orgBetaRes.json().organization.id;

    tokenBetaAdmin = authService.createMemberToken({
      id: "mem-beta-wh-admin",
      organizationId: orgBetaId,
      userId: "usr-beta-wh-admin",
      email: "admin@beta-wh.com",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).token;
  });

  // ==============================================================================
  // 1. Subscription CRUD & Verification
  // ==============================================================================
  describe("Subscription Management", () => {
    it("creates a webhook subscription with auto-generated HMAC secret", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/webhooks/subscriptions",
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
        payload: {
          organizationId: orgAlphaId,
          targetUrl: "https://greenhouse.io/webhooks/assessments/ai-copilot",
          eventTypes: ["session.submitted", "report.finalized"],
          format: "greenhouse",
        },
      });

      expect(res.statusCode).toBe(201);
      const sub = res.json();
      expect(sub.id).toMatch(/^wh_sub_/);
      expect(sub.organizationId).toBe(orgAlphaId);
      expect(sub.targetUrl).toBe("https://greenhouse.io/webhooks/assessments/ai-copilot");
      expect(sub.secret.length).toBeGreaterThanOrEqual(32);
      expect(sub.format).toBe("greenhouse");
      expect(sub.status).toBe("active");
    });

    it("lists active webhook subscriptions for the authenticated tenant", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/webhooks/subscriptions?organizationId=${orgAlphaId}`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.total).toBeGreaterThanOrEqual(1);
      expect(data.subscriptions[0].organizationId).toBe(orgAlphaId);
    });

    it("rejects subscription creation if member lacks admin/owner role", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/webhooks/subscriptions",
        headers: { authorization: `Bearer ${tokenAlphaInterviewer}` },
        payload: {
          organizationId: orgAlphaId,
          targetUrl: "https://example.com/webhook",
          eventTypes: ["session.submitted"],
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prevents Tenant Beta from deleting Tenant Alpha webhook subscription (IDOR guard)", async () => {
      // First create a subscription in Alpha
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/webhooks/subscriptions",
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
        payload: {
          organizationId: orgAlphaId,
          targetUrl: "https://lever.co/webhooks/copilot",
          eventTypes: ["*"],
          format: "lever",
        },
      });
      const subId = createRes.json().id;

      // Beta admin attempts to delete Alpha's subscription
      const deleteRes = await app.inject({
        method: "DELETE",
        url: `/api/v1/webhooks/subscriptions/${subId}?organizationId=${orgAlphaId}`,
        headers: { authorization: `Bearer ${tokenBetaAdmin}` },
      });

      expect(deleteRes.statusCode).toBe(403);
      expect(deleteRes.json().error).toBe("FORBIDDEN");
    });

    it("deletes a webhook subscription successfully when performed by tenant admin", async () => {
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/webhooks/subscriptions",
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
        payload: {
          organizationId: orgAlphaId,
          targetUrl: "https://workday.com/recruiting/webhooks",
          eventTypes: ["report.finalized"],
          format: "workday",
        },
      });
      const subId = createRes.json().id;

      const deleteRes = await app.inject({
        method: "DELETE",
        url: `/api/v1/webhooks/subscriptions/${subId}?organizationId=${orgAlphaId}`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      });

      expect(deleteRes.statusCode).toBe(204);
    });
  });

  // ==============================================================================
  // 2. Cryptographic HMAC Signature & Replay Prevention
  // ==============================================================================
  describe("Cryptographic HMAC-SHA256 Signing & Verification", () => {
    const secret = "f6d8c4e2b0a987654321fedcba098765";
    const payload = JSON.stringify({ eventId: "evt_123", candidateEmail: "dev@company.com" });

    it("generates a valid signature verifiable by receiver", () => {
      const timestamp = Date.now();
      const signature = WebhookService.signPayload(secret, timestamp, payload);

      const isValid = WebhookService.verifySignature(
        secret,
        timestamp,
        payload,
        `sha256=${signature}`
      );
      expect(isValid).toBe(true);
    });

    it("rejects tampered payload content", () => {
      const timestamp = Date.now();
      const signature = WebhookService.signPayload(secret, timestamp, payload);

      const tamperedPayload = JSON.stringify({ eventId: "evt_123", candidateEmail: "hacker@evil.com" });
      const isValid = WebhookService.verifySignature(
        secret,
        timestamp,
        tamperedPayload,
        `sha256=${signature}`
      );
      expect(isValid).toBe(false);
    });

    it("rejects replayed webhooks outside timestamp tolerance window (5 mins)", () => {
      const tenMinutesAgo = Date.now() - 600_000;
      const signature = WebhookService.signPayload(secret, tenMinutesAgo, payload);

      const isValid = WebhookService.verifySignature(
        secret,
        tenMinutesAgo,
        payload,
        `sha256=${signature}`
      );
      expect(isValid).toBe(false);
    });
  });

  // ==============================================================================
  // 3. ATS / HRIS Format Adapters
  // ==============================================================================
  describe("ATS Format Mappers", () => {
    const service = new WebhookService();
    const event: WebhookEventPayload = {
      eventId: "evt_assessment_completed_456",
      eventType: "report.finalized",
      timestamp: new Date("2026-11-02T10:00:00.000Z"),
      organizationId: "org_alpha",
      data: {
        sessionId: "sess_xyz_789",
        candidateEmail: "candidate@applicant.com",
        overallScore: 88,
        overallRecommendation: "hire",
        reportUrl: "https://copilot.internal/reports/sess_xyz_789",
      },
    };

    it("maps payload to Greenhouse Harvest partner specification", () => {
      const greenhousePayload = service.formatPayload("greenhouse", event) as any;
      expect(greenhousePayload.action).toBe("assessment_partner_update");
      expect(greenhousePayload.partner_test_id).toBe("sess_xyz_789");
      expect(greenhousePayload.candidate_id).toBe("candidate@applicant.com");
      expect(greenhousePayload.status).toBe("complete");
      expect(greenhousePayload.score).toBe(88);
      expect(greenhousePayload.results_url).toBe("https://copilot.internal/reports/sess_xyz_789");
    });

    it("maps payload to Lever opportunity assessment specification", () => {
      const leverPayload = service.formatPayload("lever", event) as any;
      expect(leverPayload.opportunityId).toBe("candidate@applicant.com");
      expect(leverPayload.stage).toBe("Technical Assessment");
      expect(leverPayload.assessment.sessionId).toBe("sess_xyz_789");
      expect(leverPayload.assessment.recommendation).toBe("hire");
      expect(leverPayload.assessment.score).toBe(88);
    });

    it("maps payload to Workday HCM recruiting assessment specification", () => {
      const workdayPayload = service.formatPayload("workday", event) as any;
      expect(workdayPayload.workdayEvent).toBe("ThirdPartyAssessmentResult");
      expect(workdayPayload.applicantId).toBe("candidate@applicant.com");
      expect(workdayPayload.assessmentReference.system).toBe("AI-Interview-Copilot");
      expect(workdayPayload.scorecard.overallRating).toBe("hire");
      expect(workdayPayload.scorecard.percentScore).toBe(88);
    });

    it("retains standard structured platform JSON format", () => {
      const standardPayload = service.formatPayload("standard", event) as any;
      expect(standardPayload.eventId).toBe("evt_assessment_completed_456");
      expect(standardPayload.eventType).toBe("report.finalized");
      expect(standardPayload.data.sessionId).toBe("sess_xyz_789");
    });
  });

  // ==============================================================================
  // 4. Outbound Dispatcher with Retry & Delivery Audit Log
  // ==============================================================================
  describe("Dispatcher Engine & Retry Backoff", () => {
    it("dispatches event to subscribers, retries on 500 error, and succeeds with audit trail", async () => {
      const service = new WebhookService();
      const sub = service.createSubscription({
        organizationId: "org_dispatch_test",
        targetUrl: "https://mock-ats.com/webhooks",
        eventTypes: ["session.submitted"],
        format: "standard",
      });

      let callCount = 0;
      const mockFetch = async (_url: any, _options: any) => {
        callCount++;
        if (callCount < 3) {
          // Fail first 2 attempts with 500
          return new Response("Internal Server Error", { status: 500 });
        }
        // Succeed on 3rd attempt with 200
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      };

      const event: WebhookEventPayload = {
        eventId: "evt_dispatch_retry_test",
        eventType: "session.submitted",
        timestamp: new Date(),
        organizationId: "org_dispatch_test",
        data: {
          sessionId: "sess_retry_123",
          candidateEmail: "retry@test.com",
        },
      };

      const logs = await service.dispatch(event, mockFetch as any);

      expect(logs.length).toBe(1);
      const log = logs[0];
      expect(log.subscriptionId).toBe(sub.id);
      expect(log.attemptCount).toBe(3);
      expect(log.success).toBe(true);
      expect(log.statusCode).toBe(200);

      // Verify audit logs query
      const retrievedLogs = service.listDeliveryLogs("org_dispatch_test");
      expect(retrievedLogs.length).toBe(1);
      expect(retrievedLogs[0].id).toBe(log.id);
    });

    it("executes ping test through API endpoint POST /subscriptions/:id/test", async () => {
      // Create subscription in Tenant Alpha
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/webhooks/subscriptions",
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
        payload: {
          organizationId: orgAlphaId,
          targetUrl: "https://mock-ats-ping.internal/webhook",
          eventTypes: ["test.ping"],
        },
      });
      const subId = createRes.json().id;

      // Note: Node's native fetch will fail to resolve the mock domain, logging failure gracefully
      const testRes = await app.inject({
        method: "POST",
        url: `/api/v1/webhooks/subscriptions/${subId}/test?organizationId=${orgAlphaId}`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      });

      expect(testRes.statusCode).toBe(200);
      const result = testRes.json();
      expect(result.deliveryLog).toBeDefined();
      expect(result.deliveryLog.eventType).toBe("test.ping");
      expect(result.deliveryLog.subscriptionId).toBe(subId);
    });

    it("queries delivery logs through API endpoint GET /logs", async () => {
      const logsRes = await app.inject({
        method: "GET",
        url: `/api/v1/webhooks/logs?organizationId=${orgAlphaId}`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      });

      expect(logsRes.statusCode).toBe(200);
      const data = logsRes.json();
      expect(Array.isArray(data.logs)).toBe(true);
      expect(typeof data.total).toBe("number");
    });
  });
});

