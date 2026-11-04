import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";

const testConfig: AppConfig = {
  PORT: 4015,
  HOST: "127.0.0.1",
  NODE_ENV: "test",
  DEFAULT_AI_PROVIDER: "mock",
  JWT_SECRET: "test-secret-key-minimum-32-characters-long-12345",
};

describe("LOOP 7 — Proctoring & Anti-Cheat Evidence Pipeline Tests", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp(testConfig);
    await app.ready();
  });

  async function createSessionFixture() {
    const orgRes = await app.inject({ method: "GET", url: "/api/v1/organizations" });
    const { organizations } = JSON.parse(orgRes.body);
    const orgId = organizations[0]?.id;

    const tmplRes = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgId}`,
    });
    const { templates } = JSON.parse(tmplRes.body);
    const templateId = templates[0]?.id;

    const sessRes = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {
        organizationId: orgId,
        templateId,
        candidateName: "Elena Rostova",
        candidateEmail: "elena@example.com",
        durationMinutes: 60,
      },
    });
    const session = JSON.parse(sessRes.body);

    // Login as interviewer
    const authRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: orgId, email: "priya@acme.corp" },
    });
    const { token: interviewerToken } = JSON.parse(authRes.body);

    return { orgId, session, interviewerToken };
  }

  it("calculates clean integrity score (100) for pristine session", async () => {
    const { session, interviewerToken } = await createSessionFixture();

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${session.id}/integrity`,
      headers: { Authorization: `Bearer ${interviewerToken}` },
    });

    expect(res.statusCode).toBe(200);
    const report = JSON.parse(res.body);
    expect(report.integrityScore).toBe(100);
    expect(report.riskLevel).toBe("clean");
    expect(report.metrics.totalBlurCount).toBe(0);
    expect(report.metrics.unattributedPasteCount).toBe(0);
  });

  it("penalizes score and elevates risk when telemetry records blur and paste bursts", async () => {
    const { session, interviewerToken } = await createSessionFixture();

    // Ingest telemetry events: 3 blurs with 30s dwell time, and 1 massive paste (250 chars)
    await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${session.id}/events`,
      payload: {
        events: [
          {
            type: "window_blur",
            timestamp: new Date().toISOString(),
            sequenceNumber: 1,
            payload: { durationMs: 15000 },
          },
          {
            type: "window_blur",
            timestamp: new Date().toISOString(),
            sequenceNumber: 2,
            payload: { durationMs: 15000 },
          },
          {
            type: "paste_detected",
            timestamp: new Date().toISOString(),
            sequenceNumber: 3,
            payload: { length: 250, isFromCopilotPatch: false },
          },
        ],
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${session.id}/integrity`,
      headers: { Authorization: `Bearer ${interviewerToken}` },
    });

    expect(res.statusCode).toBe(200);
    const report = JSON.parse(res.body);
    // Base 100 - (3 blurs * 3 = 9) - (30s / 15 = 2) - (1 paste = 10) = ~79
    expect(report.integrityScore).toBeLessThan(85);
    expect(report.metrics.totalBlurCount).toBe(2);
    expect(report.metrics.unattributedPasteCount).toBe(1);
    expect(["low", "medium"]).toContain(report.riskLevel);
  });

  it("allows interviewer to log and resolve a proctor incident", async () => {
    const { session, interviewerToken } = await createSessionFixture();

    // 1. Log incident
    const createRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${session.id}/incidents`,
      headers: { Authorization: `Bearer ${interviewerToken}` },
      payload: {
        severity: "critical",
        category: "multiple_ips",
        description: "Concurrent connection detected from distinct subnet.",
      },
    });

    expect(createRes.statusCode).toBe(201);
    const incident = JSON.parse(createRes.body);
    expect(incident.id).toBeDefined();
    expect(incident.severity).toBe("critical");
    expect(incident.isResolved).toBe(false);

    // 2. Integrity score drops to high risk
    const repRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${session.id}/integrity`,
      headers: { Authorization: `Bearer ${interviewerToken}` },
    });
    const report = JSON.parse(repRes.body);
    expect(report.riskLevel).toBe("high");
    expect(report.metrics.incidentFlagsCount).toBe(1);

    // 3. Resolve incident
    const resolveRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${session.id}/incidents/${incident.id}/resolve`,
      headers: { Authorization: `Bearer ${interviewerToken}` },
    });

    expect(resolveRes.statusCode).toBe(200);
    const resolved = JSON.parse(resolveRes.body);
    expect(resolved.isResolved).toBe(true);
  });
});
