import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import {
  SessionState,
} from "@ai-copilot/contracts";
import type { AssessmentSessionService } from "./session.js";
import type { SessionRepository } from "../repositories/session.repo.js";

describe("LOOP 10.0.4.2.3: Server Revision Authority & Autosave Idempotency Suite", () => {
  let app: FastifyInstance;
  let sessionService: AssessmentSessionService;
  let sessionRepo: SessionRepository;
  const jwtSecret = "loop-10-0-4-2-3-revision-authority-test-secret-32";
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

  async function createCandidateSession(candidateEmail = "rev_auth@test.com", candidateName = "Rev Auth Candidate") {
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
  // 1. Server revision increments exactly by one & two writes from same base
  // ==========================================================================
  it("Requirement 1: server revision increments exactly by one; two writes from same base: exactly one succeeds", async () => {
    const { sessionId, candidateToken } = await createCandidateSession("rev_inc_one@test.com", "Rev Inc Candidate");

    const initialDb = await sessionRepo.findById(sessionId);
    expect(initialDb?.lastPersistedRevision).toBe(0);

    // Write 1: baseRevision 0
    const w1 = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const w1 = true;",
        baseRevision: 0,
        clientMutationId: "mut_w1",
      },
    });
    expect(w1.statusCode).toBe(200);
    const w1Body = JSON.parse(w1.body);
    // Server revision must increment by exactly one: 0 -> 1
    expect(w1Body.revision).toBe(1);

    const dbAfterW1 = await sessionRepo.findById(sessionId);
    expect(dbAfterW1?.lastPersistedRevision).toBe(1);
    expect((dbAfterW1?.workspaceSnapshot as any)?.currentCode).toBe("export const w1 = true;");

    // Write 2: also claiming baseRevision 0
    const w2 = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const w2 = true;",
        baseRevision: 0,
        clientMutationId: "mut_w2",
      },
    });
    expect(w2.statusCode).toBe(409);
    expect(JSON.parse(w2.body).error).toBe("STALE_REVISION");

    // Database still at revision 1 with w1 code
    const finalDb = await sessionRepo.findById(sessionId);
    expect(finalDb?.lastPersistedRevision).toBe(1);
    expect((finalDb?.workspaceSnapshot as any)?.currentCode).toBe("export const w1 = true;");
  });

  // ==========================================================================
  // 2. Client cannot arbitrarily advance server revision
  // ==========================================================================
  it("Requirement 2: client cannot arbitrarily advance server revision; older base with high clientRevision rejected", async () => {
    const { sessionId, candidateToken } = await createCandidateSession("arbitrary_rev@test.com", "Arbitrary Rev Candidate");

    // Advance to revision 1 normally
    const normalSave = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const normal = 1;",
        baseRevision: 0,
        clientMutationId: "mut_norm_1",
      },
    });
    expect(normalSave.statusCode).toBe(200);
    expect(JSON.parse(normalSave.body).revision).toBe(1);

    // Attempt to jump revision to 9999 by providing clientRevision: 9999
    const jumpAttempt = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const jump = true;",
        baseRevision: 1,
        clientRevision: 9999, // Client attempts to force server to revision 9999
        clientMutationId: "mut_jump",
      },
    });
    expect(jumpAttempt.statusCode).toBe(200);
    const jumpBody = JSON.parse(jumpAttempt.body);
    // Server authority: revision MUST increment by exactly one (1 -> 2), NOT 9999!
    expect(jumpBody.revision).toBe(2);

    const dbAfterJump = await sessionRepo.findById(sessionId);
    expect(dbAfterJump?.lastPersistedRevision).toBe(2);

    // Stale base revision with higher clientRevision must be rejected
    const staleHighAttempt = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const staleHigh = true;",
        baseRevision: 0, // Stale base revision (DB is at 2)
        clientRevision: 50,
        clientMutationId: "mut_stale_high",
      },
    });
    expect(staleHighAttempt.statusCode).toBe(409);
    expect(JSON.parse(staleHighAttempt.body).error).toBe("STALE_REVISION");
  });

  // ==========================================================================
  // 3. Delayed older autosave cannot overwrite newer code
  // ==========================================================================
  it("Requirement 3: delayed older autosave cannot overwrite newer code", async () => {
    const { sessionId, candidateToken } = await createCandidateSession("delayed_cas@test.com", "Delayed CAS Candidate");

    // Write revision 1
    await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: { code: "export const rev1 = true;", baseRevision: 0, clientMutationId: "mut_r1" },
    });

    // Write revision 2
    await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: { code: "export const rev2 = true;", baseRevision: 1, clientMutationId: "mut_r2" },
    });

    // Delayed revision 1 write arrives
    const delayed = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: { code: "export const delayedRev1 = true;", baseRevision: 0, clientMutationId: "mut_delayed" },
    });
    expect(delayed.statusCode).toBe(409);
    expect(JSON.parse(delayed.body).error).toBe("STALE_REVISION");

    const finalDb = await sessionRepo.findById(sessionId);
    expect(finalDb?.lastPersistedRevision).toBe(2);
    expect((finalDb?.workspaceSnapshot as any)?.currentCode).toBe("export const rev2 = true;");
  });

  // ==========================================================================
  // 4. Lost HTTP response followed by retry: idempotent recovery
  // ==========================================================================
  it("Requirement 4: lost HTTP response followed by retry returns original committed result idempotently", async () => {
    const { sessionId, candidateToken } = await createCandidateSession("retry_idem@test.com", "Retry Idem Candidate");

    const payload = {
      code: "export const persistentCode = 42;",
      baseRevision: 0,
      clientMutationId: "mut_network_drop_123",
    };

    // First attempt commits
    const res1 = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload,
    });
    expect(res1.statusCode).toBe(200);
    const body1 = JSON.parse(res1.body);
    expect(body1.revision).toBe(1);
    expect(body1.clientMutationId).toBe("mut_network_drop_123");

    // Retry identical request (simulating lost response on client)
    const res2 = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload,
    });
    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.body);
    // Returns original committed result
    expect(body2.revision).toBe(1);
    expect(body2.clientMutationId).toBe("mut_network_drop_123");

    // Database revision has NOT advanced again; remains exactly 1
    const finalDb = await sessionRepo.findById(sessionId);
    expect(finalDb?.lastPersistedRevision).toBe(1);
    expect((finalDb?.workspaceSnapshot as any)?.currentCode).toBe("export const persistentCode = 42;");
  });

  // ==========================================================================
  // 5. Reusing a mutation ID with different content returns HTTP 409
  // ==========================================================================
  it("Requirement 5: reusing a mutation ID with different content returns HTTP 409 MUTATION_ID_CONFLICT", async () => {
    const { sessionId, candidateToken } = await createCandidateSession("mut_conflict@test.com", "Mutation Conflict Candidate");

    const mutationId = "mut_unique_key_999";

    // 1. Initial valid commit with mutation ID
    const commit1 = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const originalContent = true;",
        baseRevision: 0,
        clientMutationId: mutationId,
      },
    });
    expect(commit1.statusCode).toBe(200);
    expect(JSON.parse(commit1.body).revision).toBe(1);

    // 2. Reuse the same mutation ID with DIFFERENT content
    const conflictAttempt = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const poisonedContent = true;", // DIFFERENT CONTENT!
        baseRevision: 0,
        clientMutationId: mutationId, // SAME MUTATION ID
      },
    });

    expect(conflictAttempt.statusCode).toBe(409);
    const conflictBody = JSON.parse(conflictAttempt.body);
    expect(conflictBody.error).toBe("MUTATION_ID_CONFLICT");
    expect(conflictBody.message).toContain("already committed with different content");

    // Database content MUST NOT be mutated
    const finalDb = await sessionRepo.findById(sessionId);
    expect(finalDb?.lastPersistedRevision).toBe(1);
    expect((finalDb?.workspaceSnapshot as any)?.currentCode).toBe("export const originalContent = true;");
  });

  // ==========================================================================
  // 6. Stale base revisions remain rejected
  // ==========================================================================
  it("Requirement 6: stale base revisions remain rejected", async () => {
    const { sessionId, candidateToken } = await createCandidateSession("stale_base@test.com", "Stale Base Candidate");

    // Advance session to revision 3
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/sessions/${sessionId}/workspace`,
        headers: { Authorization: `Bearer ${candidateToken}` },
        payload: {
          code: `export const rev${i + 1} = true;`,
          baseRevision: i,
          clientMutationId: `mut_step_${i}`,
        },
      });
      expect(res.statusCode).toBe(200);
    }

    // Now send write with baseRevision: 1 (stale, DB is at 3)
    const staleRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const staleEdit = true;",
        baseRevision: 1,
        clientMutationId: "mut_stale_new",
      },
    });

    expect(staleRes.statusCode).toBe(409);
    expect(JSON.parse(staleRes.body).error).toBe("STALE_REVISION");
  });

  // ==========================================================================
  // 7. Concurrent writes cannot lose updates
  // ==========================================================================
  it("Requirement 7: concurrent writes from independent API processes cannot lose updates", async () => {
    const { sessionId, candidateToken } = await createCandidateSession("race_updates@test.com", "Race Updates Candidate");

    // Start at revision 0
    const [resAlpha, resBeta] = await Promise.all([
      app.inject({
        method: "PATCH",
        url: `/api/v1/sessions/${sessionId}/workspace`,
        headers: { Authorization: `Bearer ${candidateToken}` },
        payload: {
          code: "export const alphaCode = true;",
          baseRevision: 0,
          clientMutationId: "mut_alpha_concurrent",
        },
      }),
      app.inject({
        method: "PATCH",
        url: `/api/v1/sessions/${sessionId}/workspace`,
        headers: { Authorization: `Bearer ${candidateToken}` },
        payload: {
          code: "export const betaCode = true;",
          baseRevision: 0,
          clientMutationId: "mut_beta_concurrent",
        },
      }),
    ]);

    const statusCodes = [resAlpha.statusCode, resBeta.statusCode].sort();
    // Exactly one succeeds, one rejected with STALE_REVISION
    expect(statusCodes).toEqual([200, 409]);

    const winningCode = resAlpha.statusCode === 200 ? "export const alphaCode = true;" : "export const betaCode = true;";
    const finalDb = await sessionRepo.findById(sessionId);
    expect(finalDb?.lastPersistedRevision).toBe(1);
    expect((finalDb?.workspaceSnapshot as any)?.currentCode).toBe(winningCode);
  });

  // ==========================================================================
  // 8. Candidate editing remains blocked after the deadline
  // ==========================================================================
  it("Requirement 8: candidate editing remains blocked after editing deadline", async () => {
    const { sessionId, candidateToken } = await createCandidateSession("deadline_block@test.com", "Deadline Block Candidate");

    // Establish revision 1
    await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const onTime = true;",
        baseRevision: 0,
        clientMutationId: "mut_on_time",
      },
    });

    // Advance session past deadline
    const past = new Date(Date.now() - 10000);
    const session = sessionService.getSession(sessionId);
    session.expiresAt = past;
    await sessionRepo.update(sessionId, { expiresAt: past });

    // Attempt autosave after deadline
    const late = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const lateEdit = true;",
        baseRevision: 1,
        clientMutationId: "mut_late",
      },
    });

    expect(late.statusCode).toBe(410);
    expect(JSON.parse(late.body).error).toBe("SESSION_EXPIRED");

    const finalDb = await sessionRepo.findById(sessionId);
    expect((finalDb?.workspaceSnapshot as any)?.currentCode).toBe("export const onTime = true;");
    expect(finalDb?.lastPersistedRevision).toBe(1);
  });
});
