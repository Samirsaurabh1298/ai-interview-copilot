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

  it("returns factual telemetry report with NO candidate integrity scores or risk bands (LOOP 10.0.1)", async () => {
    const { session, interviewerToken } = await createSessionFixture();

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${session.id}/integrity`,
      headers: { Authorization: `Bearer ${interviewerToken}` },
    });

    expect(res.statusCode).toBe(200);
    const report = JSON.parse(res.body);

    // Invariant 1: No composite 0-100 score, no risk level bands
    expect(report.integrityScore).toBeUndefined();
    expect(report.riskLevel).toBeUndefined();
    expect(report.reviewStatus).toBe("verified");
    expect(report.metrics.totalBlurCount).toBe(0);
    expect(report.metrics.unattributedPasteCount).toBe(0);
    expect(report.metrics.focusRatePercent).toBe(100);
  });

  it("records factual blurs, dwell time, and paste counts without assigning composite risk scores (LOOP 10.0.1)", async () => {
    const { session, interviewerToken } = await createSessionFixture();

    // Ingest telemetry events: 2 blurs with 30s dwell time, and 1 paste (250 chars)
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

    // Invariant 1: No score calculation or risk bands
    expect(report.integrityScore).toBeUndefined();
    expect(report.riskLevel).toBeUndefined();

    // Factual telemetry counts are preserved
    expect(report.metrics.totalBlurCount).toBe(2);
    expect(report.metrics.unattributedPasteCount).toBe(1);
    expect(report.metrics.unattributedPasteChars).toBe(250);
    expect(report.metrics.focusRatePercent).toBeLessThanOrEqual(100);
    expect(report.reviewStatus).toBe("verified");
  });

  it("allows interviewer to log and resolve a proctor incident without deriving risk score", async () => {
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

    // 2. Incident flags count updates and reviewStatus reflects unresolved incident, but NO risk score is computed
    const repRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${session.id}/integrity`,
      headers: { Authorization: `Bearer ${interviewerToken}` },
    });
    const report = JSON.parse(repRes.body);
    expect(report.integrityScore).toBeUndefined();
    expect(report.riskLevel).toBeUndefined();
    expect(report.reviewStatus).toBe("unresolved_incident");
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

  it("rejects keystroke cadence or rapid_keystrokes category in proctoring schemas (LOOP 10.0.1)", async () => {
    const { session, interviewerToken } = await createSessionFixture();

    // Invariant 2: rapid_keystrokes category removed from allowed schema
    const invalidRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${session.id}/incidents`,
      headers: { Authorization: `Bearer ${interviewerToken}` },
      payload: {
        severity: "warning",
        category: "rapid_keystrokes", // no longer a valid category
        description: "Attempting to track typing speed or keystroke cadence",
      },
    });

    expect(invalidRes.statusCode).toBe(400);
    const err = JSON.parse(invalidRes.body);
    expect(err.error).toBe("INVALID_PROCTOR_INCIDENT");
  });

  it("provides evidentiary observation report without algorithmic candidate disqualification", async () => {
    const { session, interviewerToken } = await createSessionFixture();

    const repRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${session.id}/integrity`,
      headers: { Authorization: `Bearer ${interviewerToken}` },
    });

    const report = JSON.parse(repRes.body);
    expect(report.reviewStatus).toBe("verified");
    expect(report.metrics.focusRatePercent).toBe(100);
  });
});
