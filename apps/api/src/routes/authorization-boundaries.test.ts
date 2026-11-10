import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { AuthService } from "../services/auth.js";

describe("LOOP 10.0.2: Candidate-to-Company Authorization Boundary Verification", () => {
  let app: FastifyInstance;
  let authService: AuthService;
  const jwtSecret = "boundary-test-secret-key-at-least-32-chars-long";

  let orgId: string;
  let adminToken: string;
  let candidateTokenA: string;
  let candidateTokenB: string;
  let sessionIdA: string;
  let sessionIdB: string;
  let templateId: string;

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

    // 1. Create Organization
    const orgRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Boundary Audit Corp",
        slug: "boundary-audit",
        ownerEmail: "owner@boundary.corp",
        ownerName: "Boundary Owner",
        plan: "enterprise",
      },
    });
    const orgData = orgRes.json();
    orgId = orgData.organization.id;

    adminToken = authService.createMemberToken({
      id: "mem-admin",
      organizationId: orgId,
      userId: "usr-admin",
      email: "admin@boundary.corp",
      role: "admin",
      createdAt: new Date(),
    }).token;

    // 2. Create Template
    const templateRes = await app.inject({
      method: "POST",
      url: "/api/v1/templates",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        organizationId: orgId,
        title: "Systems Architecture Challenge",
        description: "High concurrency triage",
        targetRole: "Principal Systems Engineer",
        difficulty: "senior",
        durationMinutes: 60,
        allowedAIAssistance: "restricted",
        tasks: [
          {
            id: "task_1",
            title: "Task 1",
            description: "Complete the coding challenge implementation",
            type: "coding_challenge",
            order: 0,
            weight: 100,
            config: { starterCode: "// starter", verificationTestCode: "// test" },
          },
        ],
      },
    });
    templateId = templateRes.json().id;

    // 3. Create Session A for Candidate A
    const sessionARes = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        organizationId: orgId,
        templateId,
        candidateName: "Candidate Alpha",
        candidateEmail: "candidate.a@test.com",
      },
    });
    sessionIdA = sessionARes.json().id;

    // 4. Create Session B for Candidate B
    const sessionBRes = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        organizationId: orgId,
        templateId,
        candidateName: "Candidate Beta",
        candidateEmail: "candidate.b@test.com",
      },
    });
    sessionIdB = sessionBRes.json().id;

    // Generate Candidate Tokens
    candidateTokenA = authService.createCandidateToken({
      sessionId: sessionIdA,
      candidateEmail: "candidate.a@test.com",
      candidateName: "Candidate Alpha",
      organizationId: orgId,
    }).token;

    candidateTokenB = authService.createCandidateToken({
      sessionId: sessionIdB,
      candidateEmail: "candidate.b@test.com",
      candidateName: "Candidate Beta",
      organizationId: orgId,
    }).token;
  });

  describe("Candidate Access to Company Administrative Resources is Strictly Forbidden (403)", () => {
    it("rejects candidate token on GET /api/v1/templates", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/templates",
        headers: { authorization: `Bearer ${candidateTokenA}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("rejects candidate token on POST /api/v1/templates", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/templates",
        headers: { authorization: `Bearer ${candidateTokenA}` },
        payload: {
          organizationId: orgId,
          title: "Malicious Template",
          description: "Injected by candidate",
          targetRole: "Hacker",
          difficulty: "senior",
          durationMinutes: 30,
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("rejects candidate token on GET /api/v1/templates/:id", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/templates/${templateId}?organizationId=${orgId}`,
        headers: { authorization: `Bearer ${candidateTokenA}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("rejects candidate token on GET /api/v1/invitations", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/invitations?organizationId=${orgId}`,
        headers: { authorization: `Bearer ${candidateTokenA}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("rejects candidate token on POST /api/v1/invitations", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/invitations",
        headers: { authorization: `Bearer ${candidateTokenA}` },
        payload: {
          organizationId: orgId,
          templateId,
          candidateName: "Imposter",
          candidateEmail: "imposter@test.com",
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("rejects candidate token on GET /api/v1/organizations/:id/members", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/organizations/${orgId}/members`,
        headers: { authorization: `Bearer ${candidateTokenA}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("rejects candidate token on GET /api/v1/sessions (listing company submissions)", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/sessions?organizationId=${orgId}`,
        headers: { authorization: `Bearer ${candidateTokenA}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("rejects candidate token on POST /api/v1/sessions (creating arbitrary sessions)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sessions",
        headers: { authorization: `Bearer ${candidateTokenA}` },
        payload: {
          organizationId: orgId,
          templateId,
          candidateName: "Uninvited Candidate",
          candidateEmail: "uninvited@test.com",
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("rejects candidate token on GET /api/v1/sessions/:id/events (company audit log)", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/sessions/${sessionIdA}/events`,
        headers: { authorization: `Bearer ${candidateTokenA}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("rejects candidate token on GET /api/v1/sessions/:id/evaluations", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/sessions/${sessionIdA}/evaluations`,
        headers: { authorization: `Bearer ${candidateTokenA}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("rejects candidate token on GET /api/v1/sessions/:id/calibration", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/sessions/${sessionIdA}/calibration`,
        headers: { authorization: `Bearer ${candidateTokenA}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("rejects candidate token on GET /api/v1/webhooks/subscriptions", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/webhooks/subscriptions",
        headers: { authorization: `Bearer ${candidateTokenA}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("rejects candidate token on POST /api/v1/webhooks/subscriptions", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/webhooks/subscriptions",
        headers: { authorization: `Bearer ${candidateTokenA}` },
        payload: {
          organizationId: orgId,
          targetUrl: "https://attacker.com/webhook",
          eventTypes: ["session.submitted"],
          secret: "secret-key-32-bytes-long-attacker",
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("rejects candidate token on GET /api/v1/webhooks/logs", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/webhooks/logs",
        headers: { authorization: `Bearer ${candidateTokenA}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });
  });

  describe("Cross-Candidate IDOR Session Isolation", () => {
    it("allows Candidate A to access their own session workspace", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/sessions/${sessionIdA}`,
        headers: { authorization: `Bearer ${candidateTokenA}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().id).toBe(sessionIdA);
    });

    it("blocks Candidate A from accessing Candidate B's session workspace (IDOR prevention)", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/sessions/${sessionIdB}`,
        headers: { authorization: `Bearer ${candidateTokenA}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("blocks Candidate A from mutating Candidate B's session code workspace", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/sessions/${sessionIdB}/workspace`,
        headers: { authorization: `Bearer ${candidateTokenA}` },
        payload: {
          code: "// Malicious candidate A payload injected into Candidate B",
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });
  });
});
