import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";

const testConfig: AppConfig = {
  PORT: 4008,
  HOST: "127.0.0.1",
  NODE_ENV: "test",
  DEFAULT_AI_PROVIDER: "mock",
  JWT_SECRET: "test-secret-key-minimum-32-characters-long-12345",
};

describe("Proctor Controls & Incident Handling Routes (Task 15)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp(testConfig);
    await app.ready();
  });

  async function createTestSession() {
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
        candidateName: "Kai Tanaka",
        candidateEmail: "kai@example.com",
        durationMinutes: 60,
      },
    });
    const session = JSON.parse(sessRes.body);

    // Login as interviewer
    const interviewerRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: orgId, email: "priya@acme.corp" },
    });
    const { token: interviewerToken } = JSON.parse(interviewerRes.body);

    // Issue candidate token
    const tokenRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/candidate-token",
      headers: { Authorization: `Bearer ${interviewerToken}` },
      payload: {
        organizationId: orgId,
        sessionId: session.id,
        candidateId: "Kai Tanaka",
        candidateEmail: "kai@example.com",
        validitySeconds: 3600,
      },
    });
    const { token: candidateToken } = JSON.parse(tokenRes.body);

    return { orgId, templateId, session, candidateToken, interviewerToken };
  }

  it("allows interviewer to pause an active session during a technical incident", async () => {
    const { session, interviewerToken, candidateToken } = await createTestSession();

    // 1. Pause session
    const pauseRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${session.id}/pause`,
      headers: { Authorization: `Bearer ${interviewerToken}` },
      payload: { reason: "Candidate experienced local Wi-Fi drop" },
    });

    expect(pauseRes.statusCode).toBe(200);
    const pausedSession = JSON.parse(pauseRes.body);
    expect(pausedSession.status).toBe("paused");
    expect(pausedSession.pauseReason).toBe("Candidate experienced local Wi-Fi drop");
    expect(pausedSession.pausedAt).toBeDefined();

    // 2. Heartbeat reflects paused state and frozen timer
    const hbRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${session.id}/heartbeat`,
      headers: { Authorization: `Bearer ${candidateToken}` },
    });
    expect(hbRes.statusCode).toBe(200);
    const hb = JSON.parse(hbRes.body);
    expect(hb.status).toBe("paused");
    expect(hb.isPaused).toBe(true);
    expect(hb.pauseReason).toBe("Candidate experienced local Wi-Fi drop");

    // 3. Candidate editing is blocked while paused
    const editRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${session.id}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: { code: "export const modified = true;" },
    });
    expect(editRes.statusCode).toBe(409);
    const err = JSON.parse(editRes.body);
    expect(err.error).toBe("INVALID_STATE");
  });

  it("resumes paused session and dynamically extends expiration deadline by pause duration", async () => {
    const { session, interviewerToken, candidateToken } = await createTestSession();
    const originalExpiresAt = new Date(session.expiresAt).getTime();

    // Pause
    await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${session.id}/pause`,
      headers: { Authorization: `Bearer ${interviewerToken}` },
      payload: { reason: "Temporary hardware glitch" },
    });

    // Wait 50ms to simulate pause duration
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Resume
    const resumeRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${session.id}/resume`,
      headers: { Authorization: `Bearer ${interviewerToken}` },
    });

    expect(resumeRes.statusCode).toBe(200);
    const resumedSession = JSON.parse(resumeRes.body);
    expect(resumedSession.status).toBe("in_progress");
    expect(resumedSession.pausedAt).toBeUndefined();

    // Verify deadline was extended
    const newExpiresAt = new Date(resumedSession.expiresAt).getTime();
    expect(newExpiresAt).toBeGreaterThanOrEqual(originalExpiresAt + 40);

    // Verify workspace edits succeed again
    const editRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${session.id}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: { code: "export const recovered = true;" },
    });
    expect(editRes.statusCode).toBe(200);
  });

  it("prohibits candidate from self-pausing or resuming their session (RBAC check)", async () => {
    const { session, candidateToken } = await createTestSession();

    const pauseRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${session.id}/pause`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: { reason: "Candidate trying to pause timer" },
    });

    expect(pauseRes.statusCode).toBe(403);
    const err = JSON.parse(pauseRes.body);
    expect(err.error).toBe("FORBIDDEN");
  });
});
