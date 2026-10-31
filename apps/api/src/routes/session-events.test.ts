import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";

const testConfig: AppConfig = {
  PORT: 4006,
  HOST: "127.0.0.1",
  NODE_ENV: "test",
  DEFAULT_AI_PROVIDER: "mock",
  JWT_SECRET: "test-secret-key-minimum-32-characters-long-12345",
};

describe("Session Event & Evidence Collection Routes (Task 13)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp(testConfig);
    await app.ready();
  });

  async function createTestSession() {
    // 1. Get seeded org and template
    const orgRes = await app.inject({ method: "GET", url: "/api/v1/organizations" });
    const { organizations } = JSON.parse(orgRes.body);
    const orgId = organizations[0]?.id;
    expect(orgId).toBeDefined();

    const tmplRes = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgId}`,
    });
    const { templates } = JSON.parse(tmplRes.body);
    const templateId = templates[0]?.id;
    expect(templateId).toBeDefined();

    // 2. Create session
    const sessRes = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {
        organizationId: orgId,
        templateId,
        candidateName: "Alex Mercer",
        candidateEmail: "alex@example.com",
        durationMinutes: 60,
      },
    });
    const session = JSON.parse(sessRes.body);

    // 3. Login as interviewer to issue candidate token
    const interviewerRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: orgId, email: "priya@acme.corp" },
    });
    const { token: interviewerToken } = JSON.parse(interviewerRes.body);

    const tokenRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/candidate-token",
      headers: { Authorization: `Bearer ${interviewerToken}` },
      payload: {
        organizationId: orgId,
        sessionId: session.id,
        candidateId: "Alex Mercer",
        candidateEmail: "alex@example.com",
        validitySeconds: 3600,
      },
    });
    const { token: candidateToken } = JSON.parse(tokenRes.body);

    // 4. Issue reviewer auth token
    const revTokenRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: orgId, email: "marcus@acme.corp" },
    });
    const { token: reviewerToken } = JSON.parse(revTokenRes.body);

    return { orgId, templateId, session, candidateToken, reviewerToken, interviewerToken };
  }

  it("ingests an append-only batch of candidate telemetry events with monotonic sequence numbers", async () => {
    const { session, candidateToken } = await createTestSession();

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${session.id}/events`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        events: [
          {
            sequenceNumber: 1,
            type: "session_started",
            payload: { clientVersion: "1.0.0", platform: "win32" },
          },
          {
            sequenceNumber: 2,
            type: "code_snapshot",
            payload: { codeLength: 450, lines: 25 },
          },
          {
            sequenceNumber: 3,
            type: "test_run",
            payload: { passedCount: 4, totalCount: 5, durationMs: 120 },
          },
          {
            sequenceNumber: 4,
            type: "ai_patch_decision",
            payload: { decision: "accepted", diffLength: 85 },
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.acceptedCount).toBe(4);
    expect(body.latestSequenceNumber).toBe(4);
  });

  it("idempotently handles duplicate sequence numbers without corrupting the audit log", async () => {
    const { session, candidateToken } = await createTestSession();

    // First ingestion
    await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${session.id}/events`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        events: [
          { sequenceNumber: 1, type: "session_started", payload: {} },
          { sequenceNumber: 2, type: "code_snapshot", payload: {} },
        ],
      },
    });

    // Re-send seq 2 and new seq 3 (e.g. after network retry)
    const retryRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${session.id}/events`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        events: [
          { sequenceNumber: 2, type: "code_snapshot", payload: {} }, // duplicate
          { sequenceNumber: 3, type: "window_blur", payload: { blurDurationMs: 4000 } },
        ],
      },
    });

    expect(retryRes.statusCode).toBe(201);
    const body = JSON.parse(retryRes.body);
    expect(body.acceptedCount).toBe(1); // Only seq 3 accepted
    expect(body.latestSequenceNumber).toBe(3);
  });

  it("allows reviewer to retrieve chronological audit trail of all session events", async () => {
    const { session, candidateToken, reviewerToken } = await createTestSession();

    // Candidate posts events
    await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${session.id}/events`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        events: [
          { sequenceNumber: 1, type: "session_started", payload: {} },
          { sequenceNumber: 2, type: "ai_query", payload: { question: "Help with priority sort" } },
          { sequenceNumber: 3, type: "test_run", payload: { passedCount: 5, totalCount: 5 } },
        ],
      },
    });

    // Reviewer queries audit log
    const getRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${session.id}/events`,
      headers: { Authorization: `Bearer ${reviewerToken}` },
    });

    expect(getRes.statusCode).toBe(200);
    const auditLog = JSON.parse(getRes.body);
    expect(auditLog.sessionId).toBe(session.id);
    expect(auditLog.total).toBe(3);
    expect(auditLog.events[0]?.type).toBe("session_started");
    expect(auditLog.events[1]?.type).toBe("ai_query");
    expect(auditLog.events[2]?.type).toBe("test_run");
  });

  it("prohibits candidate from posting events to another candidate's session (anti-IDOR)", async () => {
    const { orgId, templateId, session: victimSession, interviewerToken } = await createTestSession();

    // Create a second session (attacker)
    const attackerRes = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {
        organizationId: orgId,
        templateId,
        candidateName: "Attacker Candidate",
        candidateEmail: "attacker@example.com",
      },
    });
    const attackerSession = JSON.parse(attackerRes.body);

    const tokenRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/candidate-token",
      headers: { Authorization: `Bearer ${interviewerToken}` },
      payload: {
        organizationId: orgId,
        sessionId: attackerSession.id,
        candidateId: "Attacker",
        validitySeconds: 3600,
      },
    });
    const { token: attackerToken } = JSON.parse(tokenRes.body);

    // Attacker attempts to post events to victimSession.id
    const attackRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${victimSession.id}/events`,
      headers: { Authorization: `Bearer ${attackerToken}` },
      payload: {
        events: [{ sequenceNumber: 1, type: "session_started", payload: {} }],
      },
    });

    expect(attackRes.statusCode).toBe(403);
    const err = JSON.parse(attackRes.body);
    expect(err.error).toBe("FORBIDDEN");
  });

  it("returns 404 when posting events to non-existent session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sessions/sess_non_existent_12345/events",
      payload: {
        events: [{ sequenceNumber: 1, type: "session_started", payload: {} }],
      },
    });

    expect(res.statusCode).toBe(404);
  });
});
