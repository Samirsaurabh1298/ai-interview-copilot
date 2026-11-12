import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";

const testConfig: AppConfig = {
  PORT: 4015,
  HOST: "127.0.0.1",
  NODE_ENV: "test",
  DEFAULT_AI_PROVIDER: "mock",
  JWT_SECRET: "test-secret-key-32-chars-minimum-safe-12345",
};

describe("Assessment Expiration, Auto-Submit & Timer Continuity", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp(testConfig);
    await app.ready();
  });

  it("returns server-authoritative expiresAt and remainingSeconds on invitation acceptance", async () => {
    // 1. Get org and template
    const orgRes = await app.inject({ method: "GET", url: "/api/v1/organizations" });
    const { organizations } = JSON.parse(orgRes.body);
    const orgId = organizations[0].id;

    const tmplRes = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgId}`,
    });
    const { templates } = JSON.parse(tmplRes.body);
    const templateId = templates[0].id;

    // Login as interviewer to obtain auth token
    const authRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: orgId, email: "priya@acme.corp" },
    });
    const { token: interviewerToken } = JSON.parse(authRes.body);

    // 2. Issue candidate invitation
    const invRes = await app.inject({
      method: "POST",
      url: "/api/v1/invitations",
      headers: { Authorization: `Bearer ${interviewerToken}` },
      payload: {
        organizationId: orgId,
        templateId,
        candidateName: "Alex Timeout",
        candidateEmail: "alex.timeout@example.com",
        expiresInDays: 7,
      },
    });
    expect(invRes.statusCode).toBe(201);
    const invitation = JSON.parse(invRes.body);

    // 3. Accept invitation
    const acceptRes = await app.inject({
      method: "POST",
      url: `/api/v1/invitations/accept/${invitation.invitationToken}`,
      payload: { agreedToIntegrityPolicy: true },
    });
    expect(acceptRes.statusCode).toBe(200);
    const sessionBootstrap = JSON.parse(acceptRes.body);

    expect(sessionBootstrap.sessionId).toBeDefined();
    expect(sessionBootstrap.expiresAt).toBeDefined();
    expect(sessionBootstrap.startedAt).toBeDefined();
    expect(sessionBootstrap.remainingSeconds).toBeGreaterThan(0);
    expect(sessionBootstrap.isSubmitted).toBe(false);

    // 4. Verify that accepting the same token again preserves original expiresAt and does NOT restart clock
    const acceptRes2 = await app.inject({
      method: "POST",
      url: `/api/v1/invitations/accept/${invitation.invitationToken}`,
      payload: { agreedToIntegrityPolicy: true },
    });
    expect(acceptRes2.statusCode).toBe(200);
    const sessionBootstrap2 = JSON.parse(acceptRes2.body);

    expect(sessionBootstrap2.sessionId).toBe(sessionBootstrap.sessionId);
    expect(sessionBootstrap2.expiresAt).toBe(sessionBootstrap.expiresAt);
    expect(sessionBootstrap2.startedAt).toBe(sessionBootstrap.startedAt);
    expect(sessionBootstrap2.remainingSeconds).toBeLessThanOrEqual(sessionBootstrap.remainingSeconds);
  });

  it("safely accepts auto-submission on an expired session and transitions to completed", async () => {
    const orgRes = await app.inject({ method: "GET", url: "/api/v1/organizations" });
    const { organizations } = JSON.parse(orgRes.body);
    const orgId = organizations[0].id;

    const tmplRes = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgId}`,
    });
    const { templates } = JSON.parse(tmplRes.body);
    const templateId = templates[0].id;

    // Login as interviewer to create invitation
    const authRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: orgId, email: "priya@acme.corp" },
    });
    const { token: interviewerToken } = JSON.parse(authRes.body);

    const invRes = await app.inject({
      method: "POST",
      url: "/api/v1/invitations",
      headers: { Authorization: `Bearer ${interviewerToken}` },
      payload: {
        organizationId: orgId,
        templateId,
        candidateName: "Jordan Expiry",
        candidateEmail: "jordan.expiry@example.com",
        expiresInDays: 7,
      },
    });
    const invitation = JSON.parse(invRes.body);

    // Accept invitation to start session
    const acceptRes = await app.inject({
      method: "POST",
      url: `/api/v1/invitations/accept/${invitation.invitationToken}`,
      payload: { agreedToIntegrityPolicy: true },
    });
    const sessionBootstrap = JSON.parse(acceptRes.body);
    const sessionId = sessionBootstrap.sessionId;

    // Artificially expire the session on the backend (past duration + grace period)
    const sessionService = (app as any).sessionService;
    if (sessionService) {
      const activeSession = sessionService.getSession(sessionId);
      activeSession.expiresAt = new Date(Date.now() - 100000); // 100 seconds in past
      activeSession.status = "expired";
    }

    // Heartbeat should report isExpired: true and remainingSeconds: 0
    const hbRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${sessionId}/heartbeat`,
    });
    expect(hbRes.statusCode).toBe(200);
    const hb = JSON.parse(hbRes.body);
    expect(hb.isExpired).toBe(true);
    expect(hb.remainingSeconds).toBe(0);

    // Submit final code (simulating auto-submit or final submit on expiry)
    const submitRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/submit`,
      payload: {
        finalCode: "export const solve = () => 'auto-submitted snapshot';",
        technicalExplanation: "Assessment time expired. System auto-submitted final work.",
        taskSubmissions: {
          task_1: {
            taskId: "task_1",
            taskType: "coding_challenge",
            status: "completed",
            codeSubmission: {
              code: "export const solve = () => 'auto-submitted snapshot';",
              language: "typescript",
            },
            maxPoints: 100,
          },
        },
      },
    });

    // CRITICAL: Submission must succeed (not throw 410 or crash)
    expect(submitRes.statusCode).toBe(200);
    const receipt = JSON.parse(submitRes.body);
    expect(receipt.status).toBe("submitted");
    expect(receipt.submissionFingerprint).toBeDefined();

    // Heartbeat must now report status: "submitted" and remainingSeconds: 0
    const hbResAfter = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${sessionId}/heartbeat`,
    });
    expect(hbResAfter.statusCode).toBe(200);
    const hbAfter = JSON.parse(hbResAfter.body);
    expect(hbAfter.status).toBe("submitted");
    expect(hbAfter.remainingSeconds).toBe(0);
    expect(hbAfter.isExpired).toBe(false);

    // Re-accepting the invitation after submission must throw 409 (cannot re-enter submitted session)
    const acceptAfterSubmit = await app.inject({
      method: "POST",
      url: `/api/v1/invitations/accept/${invitation.invitationToken}`,
      payload: { agreedToIntegrityPolicy: true },
    });
    expect(acceptAfterSubmit.statusCode).toBe(409);
    const errBody = JSON.parse(acceptAfterSubmit.body);
    expect(errBody.error).toBe("INVITATION_INVALID");
    expect(errBody.message).toContain("completed and submitted");
  });
});
