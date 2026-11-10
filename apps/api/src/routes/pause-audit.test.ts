import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { AuthService } from "../services/auth.js";

describe("LOOP 10.0.2: Session Pause/Resume Policy and Audit Trail Verification", () => {
  let app: FastifyInstance;
  let authService: AuthService;
  const jwtSecret = "pause-audit-secret-key-at-least-32-chars-long";

  let orgId: string;
  let adminToken: string;
  let candidateToken: string;
  let templateId: string;
  let sessionId: string;

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

    // 1. Setup Organization
    const orgRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Pause Policy Org",
        slug: "pause-policy-org",
        ownerEmail: "owner@pause.org",
        ownerName: "Pause Admin",
        plan: "enterprise",
      },
    });
    orgId = orgRes.json().organization.id;

    adminToken = authService.createMemberToken({
      id: "mem-pause-admin",
      organizationId: orgId,
      userId: "usr-pause-admin",
      email: "admin@pause.org",
      role: "admin",
      createdAt: new Date(),
    }).token;

    // 2. Setup Template
    const templateRes = await app.inject({
      method: "POST",
      url: "/api/v1/templates",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        organizationId: orgId,
        title: "Timed Algorithmic Challenge",
        description: "Strict 60-minute duration",
        targetRole: "Core Infrastructure Engineer",
        difficulty: "mid",
        durationMinutes: 60,
      },
    });
    templateId = templateRes.json().id;

    // 3. Create Session
    const sessionRes = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        organizationId: orgId,
        templateId,
        candidateName: "Alex Candidate",
        candidateEmail: "alex@candidate.test",
      },
    });
    sessionId = sessionRes.json().id;

    candidateToken = authService.createCandidateToken({
      sessionId,
      candidateEmail: "alex@candidate.test",
      candidateName: "Alex Candidate",
      organizationId: orgId,
    }).token;
  });

  it("strictly rejects candidate self-pause attempts (403 FORBIDDEN)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/pause`,
      headers: { authorization: `Bearer ${candidateToken}` },
      payload: {
        reason: "Candidate attempting to freeze the timer independently",
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("FORBIDDEN");
  });

  it("strictly rejects candidate self-resume attempts (403 FORBIDDEN)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/resume`,
      headers: { authorization: `Bearer ${candidateToken}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("FORBIDDEN");
  });

  it("allows company admin to pause session and logs monotonic audit event", async () => {
    const initialSessionRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${sessionId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const initialSession = initialSessionRes.json();
    expect(initialSession.status).toBe("in_progress");

    const pauseRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/pause`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        reason: "Network instability at candidate testing location reported to proctor",
      },
    });

    expect(pauseRes.statusCode).toBe(200);
    const updated = pauseRes.json();
    expect(updated.status).toBe("paused");
    expect(updated.pauseReason).toBe(
      "Network instability at candidate testing location reported to proctor"
    );
    expect(updated.pausedAt).toBeDefined();

    // Verify audit log has session_paused event
    const eventsRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${sessionId}/events`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(eventsRes.statusCode).toBe(200);
    const events = eventsRes.json().events;

    const pauseEvent = events.find((e: any) => e.type === "session_paused");
    expect(pauseEvent).toBeDefined();
    expect(pauseEvent.payload.reason).toBe(
      "Network instability at candidate testing location reported to proctor"
    );
    expect(pauseEvent.payload.initiatedBy).toBe("mem-pause-admin");
  });

  it("allows company admin to resume session, extends expiry and logs resume event", async () => {
    // Artificial small delay to simulate pause duration
    await new Promise((resolve) => setTimeout(resolve, 50));

    const resumeRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/resume`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(resumeRes.statusCode).toBe(200);
    const updated = resumeRes.json();
    expect(updated.status).toBe("in_progress");
    expect(updated.totalPausedMs).toBeGreaterThanOrEqual(40);

    // Verify audit log has session_resumed event
    const eventsRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${sessionId}/events`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(eventsRes.statusCode).toBe(200);
    const events = eventsRes.json().events;

    const resumeEvent = events.find((e: any) => e.type === "session_resumed");
    expect(resumeEvent).toBeDefined();
    expect(resumeEvent.payload.pauseDurationMs).toBeGreaterThanOrEqual(40);
    expect(resumeEvent.payload.initiatedBy).toBe("mem-pause-admin");
    expect(resumeEvent.payload.newExpiresAt).toBeDefined();
  });
});
