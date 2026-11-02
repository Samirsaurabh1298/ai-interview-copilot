import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { AuthService } from "../services/auth.js";

describe("AI Cost Analytics & Token Budget Forecasting (Task 20)", () => {
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

    // 1. Setup Tenant Alpha
    const orgAlphaRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Analytics Testing Corp",
        slug: "analytics-corp",
        ownerEmail: "owner@analytics.corp",
        ownerName: "Analytics Owner",
        plan: "enterprise",
      },
    });
    orgAlphaId = orgAlphaRes.json().organization.id;

    tokenAlphaAdmin = authService.createMemberToken({
      id: "mem-analytics-admin",
      organizationId: orgAlphaId,
      userId: "usr-analytics-admin",
      email: "admin@analytics.corp",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).token;

    tokenAlphaInterviewer = authService.createMemberToken({
      id: "mem-analytics-interviewer",
      organizationId: orgAlphaId,
      userId: "usr-analytics-interviewer",
      email: "interviewer@analytics.corp",
      role: "interviewer",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).token;

    // 2. Setup Tenant Beta
    const orgBetaRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Beta Analytics Ltd",
        slug: "beta-analytics-ltd",
        ownerEmail: "owner@beta-analytics.corp",
        ownerName: "Beta Owner",
        plan: "standard",
      },
    });
    orgBetaId = orgBetaRes.json().organization.id;

    tokenBetaAdmin = authService.createMemberToken({
      id: "mem-beta-analytics-admin",
      organizationId: orgBetaId,
      userId: "usr-beta-analytics-admin",
      email: "admin@beta-analytics.corp",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).token;

    // 3. Create Assessment Template for Tenant Alpha
    const tplRes = await app.inject({
      method: "POST",
      url: "/api/v1/templates",
      headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      payload: {
        organizationId: orgAlphaId,
        title: "Frontend Queue Assessment",
        slug: "fe-queue",
        description: "Assess frontend queue management and UI state synchronization.",
        targetRole: "Frontend Engineer",
        difficulty: "mid",
        language: "typescript",
        durationMinutes: 60,
        defaultAiBudgetUsd: 0.25,
        starterCode: "export function solve() {}",
        verificationTestCode: "test('solve', () => {});",
      },
    });
    const templateId = tplRes.json().id;

    // 4. Create Candidate Invitation & Session in Alpha
    const inviteRes = await app.inject({
      method: "POST",
      url: "/api/v1/invitations",
      headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      payload: {
        organizationId: orgAlphaId,
        templateId,
        candidateName: "Analytics Candidate",
        candidateEmail: "candidate@analytics-test.com",
        expiresInDays: 7,
      },
    });
    const invite = inviteRes.json();

    const acceptRes = await app.inject({
      method: "POST",
      url: `/api/v1/invitations/accept/${invite.invitationToken}`,
      payload: { agreedToIntegrityPolicy: true },
    });
    const session = acceptRes.json();

    // 5. Simulate AI Queries on Port/Route
    // Ingest simulated usage ledger records
    await app.inject({
      method: "POST",
      url: "/api/v1/answers",
      payload: {
        sessionId: session.sessionId,
        prompt: "How do I optimize rendering?",
        provider: "mock",
        model: "mock-model",
      },
    });
  });

  // ==============================================================================
  // 1. Comprehensive Cost Analytics Report
  // ==============================================================================
  describe("Cost Analytics Aggregation", () => {
    it("returns comprehensive AI cost analytics including token and budget utilization", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/analytics/ai-costs?organizationId=${orgAlphaId}&period=30d`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.organizationId).toBe(orgAlphaId);
      expect(data.period).toBe("30d");
      expect(typeof data.totalCostUsd).toBe("number");
      expect(data.allocatedMonthlyBudgetUsd).toBe(1000); // Enterprise plan default
      expect(typeof data.budgetUtilizationPercent).toBe("number");
      expect(typeof data.projectedMonthlySpendUsd).toBe("number");
      expect(typeof data.runwayDaysRemaining).toBe("number");
      expect(typeof data.isOverBudget).toBe("boolean");
      expect(Array.isArray(data.modelsBreakdown)).toBe(true);
      expect(Array.isArray(data.tracksBreakdown)).toBe(true);
      expect(Array.isArray(data.dailyBurnRate)).toBe(true);
      expect(Array.isArray(data.anomalies)).toBe(true);
    });

    it("allows team interviewers to view organization cost analytics", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/analytics/ai-costs?organizationId=${orgAlphaId}`,
        headers: { authorization: `Bearer ${tokenAlphaInterviewer}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().organizationId).toBe(orgAlphaId);
    });

    it("supports 7d and all period filters", async () => {
      const res7d = await app.inject({
        method: "GET",
        url: `/api/v1/analytics/ai-costs?organizationId=${orgAlphaId}&period=7d`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      });
      expect(res7d.statusCode).toBe(200);
      expect(res7d.json().period).toBe("7d");

      const resAll = await app.inject({
        method: "GET",
        url: `/api/v1/analytics/ai-costs?organizationId=${orgAlphaId}&period=all`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      });
      expect(resAll.statusCode).toBe(200);
      expect(resAll.json().period).toBe("all");
    });
  });

  // ==============================================================================
  // 2. Burn Rate & Runway Projections
  // ==============================================================================
  describe("Burn Rate & Spend Runway", () => {
    it("returns daily burn rate series and projected runway days", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/analytics/burn-rate?organizationId=${orgAlphaId}`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.organizationId).toBe(orgAlphaId);
      expect(data.allocatedMonthlyBudgetUsd).toBe(1000);
      expect(typeof data.projectedMonthlySpendUsd).toBe("number");
      expect(typeof data.runwayDaysRemaining).toBe("number");
      expect(Array.isArray(data.dailyBurnRate)).toBe(true);
    });
  });

  // ==============================================================================
  // 3. Anomaly Detection
  // ==============================================================================
  describe("Cost & Token Anomalies", () => {
    it("returns detected anomalies array", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/analytics/anomalies?organizationId=${orgAlphaId}`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.organizationId).toBe(orgAlphaId);
      expect(Array.isArray(data.anomalies)).toBe(true);
      expect(typeof data.total).toBe("number");
    });
  });

  // ==============================================================================
  // 4. Multi-Tenant IDOR Guard
  // ==============================================================================
  describe("Multi-Tenant Isolation & IDOR Protection", () => {
    it("prohibits Tenant Beta from viewing Tenant Alpha's AI cost analytics", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/analytics/ai-costs?organizationId=${orgAlphaId}`,
        headers: { authorization: `Bearer ${tokenBetaAdmin}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Tenant Beta from viewing Tenant Alpha's burn rate", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/analytics/burn-rate?organizationId=${orgAlphaId}`,
        headers: { authorization: `Bearer ${tokenBetaAdmin}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Tenant Beta from inspecting Tenant Alpha's anomalies", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/analytics/anomalies?organizationId=${orgAlphaId}`,
        headers: { authorization: `Bearer ${tokenBetaAdmin}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });
  });
});

