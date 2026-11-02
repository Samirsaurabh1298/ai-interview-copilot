import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { AuthService } from "../services/auth.js";
import { defaultTokenGuard } from "./invitations.js";

describe("Adversarial Multi-Tenant Security & IDOR Attack Suite", () => {
  let app: FastifyInstance;
  let authService: AuthService;
  const jwtSecret = "super-secure-production-grade-jwt-secret-key-32-bytes";

  // Tenant Alpha Context
  let orgAlphaId: string;
  let tokenAlphaAdmin: string;
  let tokenAlphaInterviewer: string;
  let tokenAlphaReviewer: string;
  let alphaTemplateId: string;
  let alphaSessionId: string;
  let tokenCandidateAlpha: string;

  // Tenant Beta Context
  let orgBetaId: string;
  let tokenBetaAdmin: string;
  let tokenBetaInterviewer: string;
  let betaTemplateId: string;
  let betaSessionId: string;
  let betaInvitationId: string;
  let tokenCandidateBeta: string;

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
        name: "Tenant Alpha Corp",
        slug: "alpha-corp",
        ownerEmail: "owner@alpha.com",
        ownerName: "Alpha Owner",
        plan: "enterprise",
      },
    });
    const orgAlphaData = orgAlphaRes.json();
    orgAlphaId = orgAlphaData.organization.id;

    tokenAlphaAdmin = authService.createMemberToken({
      id: "mem-alpha-admin",
      organizationId: orgAlphaId,
      userId: "usr-alpha-admin",
      email: "admin@alpha.com",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).token;

    tokenAlphaInterviewer = authService.createMemberToken({
      id: "mem-alpha-interviewer",
      organizationId: orgAlphaId,
      userId: "usr-alpha-interviewer",
      email: "interviewer@alpha.com",
      role: "interviewer",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).token;

    tokenAlphaReviewer = authService.createMemberToken({
      id: "mem-alpha-reviewer",
      organizationId: orgAlphaId,
      userId: "usr-alpha-reviewer",
      email: "reviewer@alpha.com",
      role: "reviewer",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).token;

    // 2. Setup Tenant Beta
    const orgBetaRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Tenant Beta Ltd",
        slug: "beta-ltd",
        ownerEmail: "owner@beta.com",
        ownerName: "Beta Owner",
        plan: "enterprise",
      },
    });
    const orgBetaData = orgBetaRes.json();
    orgBetaId = orgBetaData.organization.id;

    tokenBetaAdmin = authService.createMemberToken({
      id: "mem-beta-admin",
      organizationId: orgBetaId,
      userId: "usr-beta-admin",
      email: "admin@beta.com",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).token;

    tokenBetaInterviewer = authService.createMemberToken({
      id: "mem-beta-interviewer",
      organizationId: orgBetaId,
      userId: "usr-beta-interviewer",
      email: "interviewer@beta.com",
      role: "interviewer",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).token;

    // 3. Create Alpha Assessment Template
    const alphaTplRes = await app.inject({
      method: "POST",
      url: "/api/v1/templates",
      headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      payload: {
        organizationId: orgAlphaId,
        title: "Alpha Senior Backend Assessment",
        slug: "alpha-backend",
        description: "Assess backend systems architecture and algorithm implementation.",
        targetRole: "Senior Backend Engineer",
        difficulty: "senior",
        language: "typescript",
        durationMinutes: 60,
        defaultAiBudgetUsd: 0.25,
        starterCode: "export function alpha() { return 1; }",
        verificationTestCode: "test('alpha returns 1', () => {});",
      },
    });
    expect(alphaTplRes.statusCode).toBe(201);
    alphaTemplateId = alphaTplRes.json().id;

    // 4. Create Beta Assessment Template
    const betaTplRes = await app.inject({
      method: "POST",
      url: "/api/v1/templates",
      headers: { authorization: `Bearer ${tokenBetaAdmin}` },
      payload: {
        organizationId: orgBetaId,
        title: "Beta Distributed Systems Assessment",
        slug: "beta-dist-sys",
        description: "Assess distributed systems, event streams, and concurrency.",
        targetRole: "Staff Systems Engineer",
        difficulty: "staff",
        language: "typescript",
        durationMinutes: 90,
        defaultAiBudgetUsd: 0.35,
        starterCode: "export function beta() { return 2; }",
        verificationTestCode: "test('beta returns 2', () => {});",
      },
    });
    expect(betaTplRes.statusCode).toBe(201);
    betaTemplateId = betaTplRes.json().id;

    // 5. Create Beta Invitation
    const betaInviteRes = await app.inject({
      method: "POST",
      url: "/api/v1/invitations",
      headers: { authorization: `Bearer ${tokenBetaAdmin}` },
      payload: {
        organizationId: orgBetaId,
        templateId: betaTemplateId,
        candidateName: "Beta Candidate",
        candidateEmail: "candidate@beta-applicant.org",
        expiresInDays: 7,
      },
    });
    expect(betaInviteRes.statusCode).toBe(201);
    const betaInvite = betaInviteRes.json();
    betaInvitationId = betaInvite.id;

    // Accept Beta Invitation to generate beta session
    const betaAcceptRes = await app.inject({
      method: "POST",
      url: `/api/v1/invitations/accept/${betaInvite.invitationToken}`,
      payload: { agreedToIntegrityPolicy: true },
    });
    expect(betaAcceptRes.statusCode).toBe(200);
    const betaAccept = betaAcceptRes.json();
    betaSessionId = betaAccept.sessionId;
    tokenCandidateBeta = betaAccept.candidateToken;

    // 6. Create Alpha Invitation & Session
    const alphaInviteRes = await app.inject({
      method: "POST",
      url: "/api/v1/invitations",
      headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      payload: {
        organizationId: orgAlphaId,
        templateId: alphaTemplateId,
        candidateName: "Alpha Candidate",
        candidateEmail: "candidate@alpha-applicant.org",
        expiresInDays: 7,
      },
    });
    expect(alphaInviteRes.statusCode).toBe(201);
    const alphaInvite = alphaInviteRes.json();
    const alphaAcceptRes = await app.inject({
      method: "POST",
      url: `/api/v1/invitations/accept/${alphaInvite.invitationToken}`,
      payload: { agreedToIntegrityPolicy: true },
    });
    expect(alphaAcceptRes.statusCode).toBe(200);
    const alphaAccept = alphaAcceptRes.json();
    alphaSessionId = alphaAccept.sessionId;
    tokenCandidateAlpha = alphaAccept.candidateToken;
  });

  beforeEach(() => {
    defaultTokenGuard.reset("127.0.0.1");
    defaultTokenGuard.reset("global-client");
  });

  // =========================================================================
  // OWASP API #1: Broken Object Level Authorization (IDOR) - Templates
  // =========================================================================
  describe("Template Isolation & Cross-Tenant Access Prevention", () => {
    it("prohibits Tenant Alpha from listing Tenant Beta templates", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/templates?organizationId=${orgBetaId}`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Tenant Alpha from fetching single Tenant Beta template by ID", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/templates/${betaTemplateId}?organizationId=${orgBetaId}`,
        headers: { authorization: `Bearer ${tokenAlphaInterviewer}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Tenant Alpha from modifying Tenant Beta template", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/templates/${betaTemplateId}?organizationId=${orgBetaId}`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
        payload: { title: "Hacked by Alpha" },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Tenant Alpha from publishing Tenant Beta template", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/templates/${betaTemplateId}/publish?organizationId=${orgBetaId}`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Tenant Alpha from deleting Tenant Beta template", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/templates/${betaTemplateId}?organizationId=${orgBetaId}`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });
  });

  // =========================================================================
  // OWASP API #1: Broken Object Level Authorization (IDOR) - Sessions
  // =========================================================================
  describe("Session Isolation & Proctor Control Prevention", () => {
    it("prohibits Tenant Alpha from listing Tenant Beta sessions", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/sessions?organizationId=${orgBetaId}`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Tenant Alpha from reading Tenant Beta session details", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/sessions/${betaSessionId}`,
        headers: { authorization: `Bearer ${tokenAlphaInterviewer}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Tenant Alpha from pausing Tenant Beta candidate session", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/sessions/${betaSessionId}/pause`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
        payload: { reason: "Malicious pause" },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Tenant Alpha from resuming Tenant Beta candidate session", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/sessions/${betaSessionId}/resume`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Tenant Alpha from terminating Tenant Beta candidate session", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/sessions/${betaSessionId}/terminate`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
        payload: { reason: "Malicious terminate" },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });
  });

  // =========================================================================
  // OWASP API #1: Candidate Token Scoping & Session Boundary Quarantining
  // =========================================================================
  describe("Candidate Token Scoping & Cross-Session Access Prevention", () => {
    it("prohibits Candidate Alpha from viewing Candidate Beta session", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/sessions/${betaSessionId}`,
        headers: { authorization: `Bearer ${tokenCandidateAlpha}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Candidate Alpha from modifying Candidate Beta workspace", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/sessions/${betaSessionId}/workspace`,
        headers: { authorization: `Bearer ${tokenCandidateAlpha}` },
        payload: { code: "malicious code injection" },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Candidate Alpha from submitting Candidate Beta assessment", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/sessions/${betaSessionId}/submit`,
        headers: { authorization: `Bearer ${tokenCandidateAlpha}` },
        payload: { finalCode: "corrupted", explanation: "stolen" },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Candidate Alpha from posting telemetry events to Candidate Beta session", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/sessions/${betaSessionId}/events`,
        headers: { authorization: `Bearer ${tokenCandidateAlpha}` },
        payload: {
          events: [
            {
              sequenceNumber: 1,
              type: "paste_detected",
              payload: { length: 50 },
            },
          ],
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Candidate Alpha from inspecting Candidate Beta telemetry events", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/sessions/${betaSessionId}/events`,
        headers: { authorization: `Bearer ${tokenCandidateAlpha}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Candidate Alpha from inspecting Candidate Beta submission artifact", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/sessions/${betaSessionId}/submission`,
        headers: { authorization: `Bearer ${tokenCandidateAlpha}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Candidate Alpha from downloading Candidate Beta hiring report", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/sessions/${betaSessionId}/report`,
        headers: { authorization: `Bearer ${tokenCandidateAlpha}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });
  });

  // =========================================================================
  // OWASP API #1: Broken Object Level Authorization (IDOR) - Invitations & Members
  // =========================================================================
  describe("Invitations & Membership Organization Boundary", () => {
    it("prohibits Tenant Alpha from listing Tenant Beta candidate invitations", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/invitations?organizationId=${orgBetaId}`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Tenant Alpha from revoking Tenant Beta candidate invitation", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/invitations/${betaInvitationId}/revoke?organizationId=${orgBetaId}`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Tenant Alpha from creating invitation under Tenant Beta organization", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/invitations",
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
        payload: {
          organizationId: orgBetaId,
          templateId: betaTemplateId,
          candidateName: "Imposter Candidate",
          candidateEmail: "imposter@corp.com",
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Tenant Alpha from listing Tenant Beta members", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/organizations/${orgBetaId}/members`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Tenant Alpha from adding a member to Tenant Beta", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/organizations/${orgBetaId}/members`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
        payload: {
          email: "trojan@alpha.com",
          name: "Trojan User",
          role: "admin",
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });
  });

  // =========================================================================
  // OWASP API #1: Broken Object Level Authorization (IDOR) - Calibration & Reports
  // =========================================================================
  describe("Calibration & Report Tenant Privacy", () => {
    it("prohibits Tenant Alpha reviewer from submitting scoring evaluation to Tenant Beta session", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/sessions/${betaSessionId}/evaluations`,
        headers: { authorization: `Bearer ${tokenAlphaReviewer}` },
        payload: {
          scores: [
            { dimensionId: "code-comprehension", name: "Code Comprehension", rating: 4, rationale: "Clean architectural localization." },
            { dimensionId: "problem-framing", name: "Problem Framing", rating: 3, rationale: "Clearly identified ticket requirements." },
            { dimensionId: "ai-collaboration", name: "AI Collaboration", rating: 4, rationale: "Prompt formulations were highly structured." },
            { dimensionId: "critical-evaluation", name: "Critical Evaluation", rating: 3, rationale: "Scrutinized patch before applying." },
            { dimensionId: "debugging-implementation", name: "Debugging", rating: 4, rationale: "Zero regressions introduced." },
            { dimensionId: "testing-verification", name: "Testing", rating: 3, rationale: "Verified edge cases in sandbox." },
            { dimensionId: "explanation-judgment", name: "Explanation", rating: 3, rationale: "Trade-offs well reasoned." },
          ],
          recommendation: "hire",
          summaryRationale: "Tenant Alpha reviewer attempting cross-tenant evaluation",
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Tenant Alpha reviewer from querying Tenant Beta evaluations", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/sessions/${betaSessionId}/evaluations`,
        headers: { authorization: `Bearer ${tokenAlphaReviewer}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Tenant Alpha admin from generating or downloading Tenant Beta hiring report", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/sessions/${betaSessionId}/report`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });

    it("prohibits Tenant Alpha admin from exporting Tenant Beta HTML report", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/sessions/${betaSessionId}/report/export`,
        headers: { authorization: `Bearer ${tokenAlphaAdmin}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("FORBIDDEN");
    });
  });

  // =========================================================================
  // Token Brute-Force & Enumeration Protection
  // =========================================================================
  describe("Invitation Token Brute-Force Rate Limiting Guard", () => {
    it("blocks rapid non-existent token probing after 10 failed attempts with HTTP 429", async () => {
      defaultTokenGuard.reset("127.0.0.1");

      // 10 failed requests
      for (let i = 0; i < 10; i++) {
        const probeRes = await app.inject({
          method: "GET",
          url: `/api/v1/invitations/verify/fake-brute-force-token-${i}`,
        });
        expect(probeRes.statusCode).toBe(404);
      }

      // 11th request triggers HTTP 429 Too Many Requests
      const throttledRes = await app.inject({
        method: "GET",
        url: "/api/v1/invitations/verify/fake-brute-force-token-11",
      });

      expect(throttledRes.statusCode).toBe(429);
      expect(throttledRes.json().error).toBe("TOO_MANY_REQUESTS");
    });
  });
});
