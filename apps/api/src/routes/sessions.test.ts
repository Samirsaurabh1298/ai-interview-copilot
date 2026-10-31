import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";

const testConfig: AppConfig = {
  PORT: 4003,
  HOST: "127.0.0.1",
  NODE_ENV: "test",
  DEFAULT_AI_PROVIDER: "mock",
  JWT_SECRET: "test-secret-key-32-chars-minimum-safe-12345",
};

describe("Assessment Session Lifecycle & Expiration Routes (Task 11)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp(testConfig);
    await app.ready();
  });

  it("creates an assessment session with server-calculated expiration time", async () => {
    const orgRes = await app.inject({ method: "GET", url: "/api/v1/organizations" });
    const { organizations } = JSON.parse(orgRes.body);
    const orgId = organizations[0].id;

    const tmplRes = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgId}`,
    });
    const { templates } = JSON.parse(tmplRes.body);
    const templateId = templates[0].id;

    const sessionRes = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {
        organizationId: orgId,
        templateId,
        candidateName: "Jordan Lee",
        candidateEmail: "jordan.lee@example.com",
        durationMinutes: 45,
      },
    });

    expect(sessionRes.statusCode).toBe(201);
    const session = JSON.parse(sessionRes.body);
    expect(session.id).toMatch(/^sess_/);
    expect(session.status).toBe("in_progress");
    expect(session.durationMinutes).toBe(45);
    expect(session.workspaceSnapshot.currentCode).toBeDefined();

    // Verify expiration is ~45 minutes in the future
    const startMs = new Date(session.startedAt).getTime();
    const expireMs = new Date(session.expiresAt).getTime();
    const diffMinutes = Math.round((expireMs - startMs) / (60 * 1000));
    expect(diffMinutes).toBe(45);
  });

  it("provides live heartbeat telemetry with remaining seconds and budget warnings", async () => {
    const orgRes = await app.inject({ method: "GET", url: "/api/v1/organizations" });
    const { organizations } = JSON.parse(orgRes.body);
    const orgId = organizations[0].id;

    const tmplRes = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgId}`,
    });
    const { templates } = JSON.parse(tmplRes.body);
    const templateId = templates[0].id;

    const sessionRes = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {
        organizationId: orgId,
        templateId,
        candidateName: "Taylor Swift",
        candidateEmail: "taylor@example.com",
        durationMinutes: 60,
      },
    });
    const session = JSON.parse(sessionRes.body);

    const hbRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${session.id}/heartbeat`,
    });

    expect(hbRes.statusCode).toBe(200);
    const hb = JSON.parse(hbRes.body);
    expect(hb.sessionId).toBe(session.id);
    expect(hb.status).toBe("in_progress");
    expect(hb.remainingSeconds).toBeGreaterThan(3500);
    expect(hb.remainingSeconds).toBeLessThanOrEqual(3600);
    expect(hb.isExpired).toBe(false);
    expect(hb.inGracePeriod).toBe(false);
    expect(hb.budgetWarning).toBe(false);
  });

  it("persists workspace autosaves and captures test results", async () => {
    const orgRes = await app.inject({ method: "GET", url: "/api/v1/organizations" });
    const { organizations } = JSON.parse(orgRes.body);
    const orgId = organizations[0].id;

    const tmplRes = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgId}`,
    });
    const { templates } = JSON.parse(tmplRes.body);
    const templateId = templates[0].id;

    const sessionRes = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {
        organizationId: orgId,
        templateId,
        candidateName: "Dev Candidate",
        candidateEmail: "dev@example.com",
      },
    });
    const session = JSON.parse(sessionRes.body);

    const newCode = `export function filterAndSortTickets() { return []; }`;
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${session.id}/workspace`,
      payload: {
        code: newCode,
        testResults: [
          { name: "test 1", passed: true, durationMs: 12 },
          { name: "test 2", passed: false, durationMs: 15, error: "AssertionFailed" },
        ],
      },
    });

    expect(patchRes.statusCode).toBe(200);

    // Fetch session to verify persisted code
    const getRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${session.id}`,
    });
    const updatedSession = JSON.parse(getRes.body);
    expect(updatedSession.workspaceSnapshot.currentCode).toBe(newCode);
    expect(updatedSession.workspaceSnapshot.lastTestPassedCount).toBe(1);
    expect(updatedSession.workspaceSnapshot.lastTestTotalCount).toBe(2);
  });

  it("submits candidate solution and marks session as submitted", async () => {
    const orgRes = await app.inject({ method: "GET", url: "/api/v1/organizations" });
    const { organizations } = JSON.parse(orgRes.body);
    const orgId = organizations[0].id;

    const tmplRes = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgId}`,
    });
    const { templates } = JSON.parse(tmplRes.body);
    const templateId = templates[0].id;

    const sessionRes = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {
        organizationId: orgId,
        templateId,
        candidateName: "Morgan Chen",
        candidateEmail: "morgan@example.com",
      },
    });
    const session = JSON.parse(sessionRes.body);

    const submitRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${session.id}/submit`,
      payload: {
        finalCode: "export const finalImplementation = true;",
        explanation: "Refactored ticket priority sorting with strict immutability checks.",
      },
    });

    expect(submitRes.statusCode).toBe(200);
    const result = JSON.parse(submitRes.body);
    expect(result.status).toBe("submitted");
    expect(result.submittedAt).toBeDefined();

    // Verify subsequent modifications are blocked
    const blockedPatch = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${session.id}/workspace`,
      payload: { code: "trying to modify after submit" },
    });
    expect(blockedPatch.statusCode).toBe(409);
  });

  it("enforces emergency termination by interviewer", async () => {
    const orgRes = await app.inject({ method: "GET", url: "/api/v1/organizations" });
    const { organizations } = JSON.parse(orgRes.body);
    const orgId = organizations[0].id;

    const tmplRes = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgId}`,
    });
    const { templates } = JSON.parse(tmplRes.body);
    const templateId = templates[0].id;

    const sessionRes = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {
        organizationId: orgId,
        templateId,
        candidateName: "Incident Candidate",
        candidateEmail: "incident@example.com",
      },
    });
    const session = JSON.parse(sessionRes.body);

    const termRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${session.id}/terminate`,
      payload: { reason: "Security violation detected in code execution" },
    });

    expect(termRes.statusCode).toBe(200);
    const terminated = JSON.parse(termRes.body);
    expect(terminated.status).toBe("terminated");
    expect(terminated.terminationReason).toBe("Security violation detected in code execution");
  });
});

