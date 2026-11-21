import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import {
  SessionState,
} from "@ai-copilot/contracts";
import type { AssessmentSessionService } from "./session.js";
import type { SessionRepository } from "../repositories/session.repo.js";

describe("LOOP 10.0.4.2.2: Strict Autosave Revision CAS Suite", () => {
  let app: FastifyInstance;
  let sessionService: AssessmentSessionService;
  let sessionRepo: SessionRepository;
  const jwtSecret = "loop-10-0-4-2-2-cas-test-secret-key-32";
  let orgId: string;
  let templateId: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildApp({
      PORT: 0,
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

    const orgRes = await app.inject({ method: "GET", url: "/api/v1/organizations" });
    const { organizations } = JSON.parse(orgRes.body);
    orgId = organizations[0].id;

    const tmplRes = await app.inject({ method: "GET", url: `/api/v1/templates?organizationId=${orgId}` });
    const { templates } = JSON.parse(tmplRes.body);
    templateId = templates[0].id;

    const authRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: orgId, email: "priya@acme.corp" },
    });
    adminToken = JSON.parse(authRes.body).token;

    sessionService = (app as any).sessionService;
    sessionRepo = sessionService.getRepo();
  });

  afterAll(async () => {
    await app.close();
  });

  async function createCandidateSession(candidateEmail = "cas_cand@test.com", candidateName = "CAS Candidate") {
    const invRes = await app.inject({
      method: "POST",
      url: "/api/v1/invitations",
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        organizationId: orgId,
        templateId,
        candidateName,
        candidateEmail,
        expiresInDays: 7,
      },
    });
    expect(invRes.statusCode).toBe(201);
    const invitation = invRes.json();

    const acceptRes = await app.inject({
      method: "POST",
      url: `/api/v1/invitations/accept/${invitation.invitationToken}`,
      payload: { agreedToIntegrityPolicy: true },
    });
    expect(acceptRes.statusCode).toBe(200);
    const sessionBootstrap = acceptRes.json();

    return {
      invitation,
      sessionBootstrap,
      sessionId: sessionBootstrap.sessionId as string,
      candidateToken: sessionBootstrap.candidateToken as string,
    };
  }

  // ==========================================================================
  // 1. Two writes from the same base revision: exactly one succeeds
  // ==========================================================================
  it("Test 1: two writes from the same base revision: exactly one succeeds", async () => {
    const { sessionId, candidateToken } = await createCandidateSession("same_base@test.com", "Same Base Candidate");

    // Initial DB revision is 0
    const initialDb = await sessionRepo.findById(sessionId);
    expect(initialDb?.lastPersistedRevision).toBe(0);

    // First write from baseRevision 0
    const write1 = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const writeOne = true;",
        baseRevision: 0,
        clientRevision: 1,
        clientMutationId: "mut_cas_t1_w1",
      },
    });
    expect(write1.statusCode).toBe(200);

    // Second write also claiming baseRevision 0 (conflicting concurrent edit)
    const write2 = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const writeTwo = true;",
        baseRevision: 0,
        clientRevision: 1,
        clientMutationId: "mut_cas_t1_w2",
      },
    });
    expect(write2.statusCode).toBe(409);
    const body2 = JSON.parse(write2.body);
    expect(body2.error).toBe("STALE_REVISION");

    // Database reflects write 1 only
    const finalDb = await sessionRepo.findById(sessionId);
    expect(finalDb?.lastPersistedRevision).toBe(1);
    expect((finalDb?.workspaceSnapshot as any)?.currentCode).toBe("export const writeOne = true;");
  });

  // ==========================================================================
  // 2. Older base revision with a higher client revision: rejected
  // ==========================================================================
  it("Test 2: older base revision with a higher client revision: rejected", async () => {
    const { sessionId, candidateToken } = await createCandidateSession("higher_client@test.com", "Higher Client Candidate");

    // Advance to revision 1, 2, 3
    for (let r = 0; r < 3; r++) {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/sessions/${sessionId}/workspace`,
        headers: { Authorization: `Bearer ${candidateToken}` },
        payload: {
          code: `export const rev${r + 1} = true;`,
          baseRevision: r,
          clientRevision: r + 1,
          clientMutationId: `mut_cas_t2_${r}`,
        },
      });
      expect(res.statusCode).toBe(200);
    }

    const dbAt3 = await sessionRepo.findById(sessionId);
    expect(dbAt3?.lastPersistedRevision).toBe(3);
    expect((dbAt3?.workspaceSnapshot as any)?.currentCode).toBe("export const rev3 = true;");

    // Adversarial / desynced write: baseRevision 1 (older than 3), clientRevision 10 (higher than 3)
    const clobberRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const clobberAttempt = true;",
        baseRevision: 1, // Stale base revision!
        clientRevision: 10, // Artificially high client revision
        clientMutationId: "mut_cas_t2_clobber",
      },
    });

    expect(clobberRes.statusCode).toBe(409);
    const clobberBody = JSON.parse(clobberRes.body);
    expect(clobberBody.error).toBe("STALE_REVISION");

    // Database code and revision remain at revision 3
    const finalDb = await sessionRepo.findById(sessionId);
    expect(finalDb?.lastPersistedRevision).toBe(3);
    expect((finalDb?.workspaceSnapshot as any)?.currentCode).toBe("export const rev3 = true;");
  });

  // ==========================================================================
  // 3. Delayed older autosave cannot overwrite newer code
  // ==========================================================================
  it("Test 3: delayed older autosave cannot overwrite newer code", async () => {
    const { sessionId, candidateToken } = await createCandidateSession("delayed_save@test.com", "Delayed Save Candidate");

    // Save revision 1
    await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const codeRev1 = true;",
        baseRevision: 0,
        clientRevision: 1,
        clientMutationId: "mut_cas_t3_1",
      },
    });

    // Save revision 2
    await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const codeRev2 = true;",
        baseRevision: 1,
        clientRevision: 2,
        clientMutationId: "mut_cas_t3_2",
      },
    });

    // Verify DB is at revision 2
    const dbAt2 = await sessionRepo.findById(sessionId);
    expect(dbAt2?.lastPersistedRevision).toBe(2);
    expect((dbAt2?.workspaceSnapshot as any)?.currentCode).toBe("export const codeRev2 = true;");

    // Delayed network arrival: old revision 1 payload arrives
    const delayedSave = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const codeRev1Delayed = true;",
        baseRevision: 0,
        clientRevision: 1,
        clientMutationId: "mut_cas_t3_delayed",
      },
    });

    expect(delayedSave.statusCode).toBe(409);
    expect(JSON.parse(delayedSave.body).error).toBe("STALE_REVISION");

    // Code in DB MUST still be codeRev2, revision MUST still be 2
    const finalDb = await sessionRepo.findById(sessionId);
    expect(finalDb?.lastPersistedRevision).toBe(2);
    expect((finalDb?.workspaceSnapshot as any)?.currentCode).toBe("export const codeRev2 = true;");
  });

  // ==========================================================================
  // 4. Lost HTTP response followed by retry: idempotent recovery
  // ==========================================================================
  it("Test 4: lost HTTP response followed by retry: idempotent recovery", async () => {
    const { sessionId, candidateToken } = await createCandidateSession("retry_save@test.com", "Retry Save Candidate");

    const payload = {
      code: "export const retryCode = true;",
      baseRevision: 0,
      clientRevision: 1,
      clientMutationId: "mut_cas_t4_retry",
    };

    // First attempt: succeeds and writes to DB
    const firstAttempt = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload,
    });
    expect(firstAttempt.statusCode).toBe(200);
    const firstBody = JSON.parse(firstAttempt.body);
    expect(firstBody.sessionId).toBe(sessionId);

    const dbAfterFirst = await sessionRepo.findById(sessionId);
    expect(dbAfterFirst?.lastPersistedRevision).toBe(1);
    expect((dbAfterFirst?.workspaceSnapshot as any)?.currentCode).toBe("export const retryCode = true;");

    // Simulate lost HTTP response -> Client retries the identical request
    const retryAttempt = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload,
    });

    // Idempotent recovery MUST return 200, not 409
    expect(retryAttempt.statusCode).toBe(200);
    const retryBody = JSON.parse(retryAttempt.body);
    expect(retryBody.sessionId).toBe(sessionId);

    // Database revision MUST NOT double-increment; remains at 1
    const dbAfterRetry = await sessionRepo.findById(sessionId);
    expect(dbAfterRetry?.lastPersistedRevision).toBe(1);
    expect((dbAfterRetry?.workspaceSnapshot as any)?.currentCode).toBe("export const retryCode = true;");
  });

  // ==========================================================================
  // 5. Autosave after editing deadline: rejected
  // ==========================================================================
  it("Test 5: autosave after editing deadline: rejected", async () => {
    const { sessionId, candidateToken } = await createCandidateSession("deadline_save@test.com", "Deadline Save Candidate");

    // Establish valid revision 1
    await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const preDeadline = true;",
        baseRevision: 0,
        clientRevision: 1,
        clientMutationId: "mut_cas_t5_1",
      },
    });

    // Advance session clock 5 seconds past expiresAt
    const pastExpiresAt = new Date(Date.now() - 5000);
    const session = sessionService.getSession(sessionId);
    session.expiresAt = pastExpiresAt;
    await sessionRepo.update(sessionId, { expiresAt: pastExpiresAt });

    // Attempt autosave after deadline
    const lateSave = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const postDeadlineAttempt = true;",
        baseRevision: 1,
        clientRevision: 2,
        clientMutationId: "mut_cas_t5_late",
      },
    });

    expect(lateSave.statusCode).toBe(410);
    expect(JSON.parse(lateSave.body).error).toBe("SESSION_EXPIRED");

    // Database code must remain the pre-deadline code
    const finalDb = await sessionRepo.findById(sessionId);
    expect((finalDb?.workspaceSnapshot as any)?.currentCode).toBe("export const preDeadline = true;");
    expect(finalDb?.lastPersistedRevision).toBe(1);
  });

  // ==========================================================================
  // 6. Concurrent writes from two independent API processes
  // ==========================================================================
  it("Test 6: concurrent writes from two independent API processes", async () => {
    const { sessionId, candidateToken } = await createCandidateSession("concurrent_save@test.com", "Concurrent Save Candidate");

    // Establish base revision 1
    await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const baseCode = true;",
        baseRevision: 0,
        clientRevision: 1,
        clientMutationId: "mut_cas_t6_base",
      },
    });

    // Dispatch concurrent writes from Process Alpha and Process Beta claiming the same baseRevision 1
    const [alphaRes, betaRes] = await Promise.all([
      app.inject({
        method: "PATCH",
        url: `/api/v1/sessions/${sessionId}/workspace`,
        headers: { Authorization: `Bearer ${candidateToken}` },
        payload: {
          code: "export const alphaCode = true;",
          baseRevision: 1,
          clientRevision: 2,
          clientMutationId: "mut_cas_t6_alpha",
        },
      }),
      app.inject({
        method: "PATCH",
        url: `/api/v1/sessions/${sessionId}/workspace`,
        headers: { Authorization: `Bearer ${candidateToken}` },
        payload: {
          code: "export const betaCode = true;",
          baseRevision: 1,
          clientRevision: 2,
          clientMutationId: "mut_cas_t6_beta",
        },
      }),
    ]);

    const statusCodes = [alphaRes.statusCode, betaRes.statusCode].sort();
    // Exactly ONE must succeed (200) and ONE must fail CAS (409)
    expect(statusCodes).toEqual([200, 409]);

    const winnerCode = alphaRes.statusCode === 200
      ? "export const alphaCode = true;"
      : "export const betaCode = true;";

    // Database must reflect the winning process's code with revision 2
    const finalDb = await sessionRepo.findById(sessionId);
    expect(finalDb?.lastPersistedRevision).toBe(2);
    expect((finalDb?.workspaceSnapshot as any)?.currentCode).toBe(winnerCode);
  });
});
