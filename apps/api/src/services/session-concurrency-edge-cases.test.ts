import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import {
  SessionState,
  type SubmissionArtifact,
} from "@ai-copilot/contracts";
import type { AssessmentSessionService } from "./session.js";
import type { SubmissionService } from "./submission.js";
import type { SessionRepository } from "../repositories/session.repo.js";
import type { SubmissionRepository } from "../repositories/submission.repo.js";
import { getDb } from "../db/connection.js";
import { submissionArtifacts, assessmentSessions } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";

describe("LOOP 10.0.4.2.1: Database Concurrency & Deadline Edge-Case Verification Suite", () => {
  let app: FastifyInstance;
  let sessionService: AssessmentSessionService;
  let submissionService: SubmissionService;
  let sessionRepo: SessionRepository;
  let submissionRepo: SubmissionRepository;
  const jwtSecret = "loop-10-0-4-2-1-concurrency-test-secret-key-32";
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
    submissionService = (app as any).submissionService;
    sessionRepo = sessionService.getRepo();
    submissionRepo = submissionService["repo"];
  });

  afterAll(async () => {
    await app.close();
  });

  async function createCandidateSession(candidateEmail = "concurrency_cand@test.com", candidateName = "Concurrency Candidate") {
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
  // 1. NOW() vs clock_timestamp() Behavior in Long Transactions
  // ==========================================================================
  it("Criterion 1: clock_timestamp() correctly evaluates live wall-clock time in transactions where NOW() would be frozen", async () => {
    const db = await getDb();

    // Verify PostgreSQL / PGlite semantic difference:
    // In a single transaction with a delay, NOW() is frozen at transaction start,
    // while clock_timestamp() reflects the real wall-clock time after the delay.
    const txResult = await db.transaction(async (tx) => {
      const t1 = await tx.execute(sql`SELECT NOW() as t_now, clock_timestamp() as t_clock`);
      // Busy wait / sleep 25ms
      const start = Date.now();
      while (Date.now() - start < 25) {
        // tight loop to ensure elapsed wall clock time
      }
      const t2 = await tx.execute(sql`SELECT NOW() as t_now, clock_timestamp() as t_clock`);
      return {
        now1: new Date((t1.rows[0] as any).t_now).getTime(),
        now2: new Date((t2.rows[0] as any).t_now).getTime(),
        clock1: new Date((t1.rows[0] as any).t_clock).getTime(),
        clock2: new Date((t2.rows[0] as any).t_clock).getTime(),
      };
    });

    // NOW() must be identical at start and end of transaction
    expect(txResult.now1).toBe(txResult.now2);
    // clock_timestamp() must advance to reflect elapsed wall-clock time
    expect(txResult.clock2).toBeGreaterThan(txResult.clock1);

    // Now test deadline enforcement in sessionRepo:
    const { sessionId } = await createCandidateSession("clock_ts@test.com", "Clock Ts Candidate");
    
    // Set expiresAt to 10ms from now
    const nearExpiry = new Date(Date.now() + 10);
    await sessionRepo.update(sessionId, { expiresAt: nearExpiry });
    const session = sessionService.getSession(sessionId);
    session.expiresAt = nearExpiry;

    // Sleep 30ms so wall clock passes nearExpiry
    await new Promise((r) => setTimeout(r, 30));

    // updateWorkspaceSnapshot uses clock_timestamp() <= expiresAt
    // It must evaluate against live clock (> nearExpiry) and reject the update (return null)
    const updateResult = await sessionRepo.updateWorkspaceSnapshot(sessionId, {
      currentCode: "export const pastDeadline = true;",
      lastSavedAt: new Date(),
      revision: 99,
    });

    expect(updateResult).toBeNull();
  });

  // ==========================================================================
  // 2. Failed Sealing Transition Explicitly Rolls Back Artifact Insertion
  // ==========================================================================
  it("Criterion 2: guarantees failed sealing transition explicitly rolls back artifact insertion (0 artifacts in DB)", async () => {
    const db = await getDb();
    const { sessionId } = await createCandidateSession("rollback_seal@test.com", "Rollback Seal Candidate");

    const session = await sessionRepo.findById(sessionId);
    expect(session?.status).toBe(SessionState.ACTIVE);

    const artifact: SubmissionArtifact = {
      id: `sub_should_rollback_${Date.now()}`,
      sessionId,
      organizationId: orgId,
      templateId,
      candidateName: "Rollback Candidate",
      candidateEmail: "rollback_seal@test.com",
      submittedAt: new Date(),
      finalCode: "export const rollbackCode = true;",
      starterCode: "// starter",
      codeDiff: { additions: 1, deletions: 0, totalChanges: 1, unifiedDiff: "" },
      testExecutionLog: { status: "NOT_RUN", statusReason: "Disabled", passed: null, exitCode: null, passedCount: 0, totalCount: 0, durationMs: 0, stdout: "", stderr: "" },
      technicalExplanation: "Attempt sealing from ACTIVE - must rollback",
      telemetrySummary: { totalEvents: 0, aiQueriesCount: 0, consumedAiBudgetUsd: 0, patchDecisions: { accepted: 0, rejected: 0 }, attentionMetrics: { blurCount: 0, pasteCount: 0 } },
      templateContentHash: "a".repeat(64),
      submissionFingerprint: "b".repeat(64),
    };

    // 1. Direct call to sealArtifactAndTransitionSession from ACTIVE (invalid state)
    const sealResult = await submissionRepo.sealArtifactAndTransitionSession(
      artifact,
      { submittedAt: new Date(), workspaceSnapshot: { currentCode: artifact.finalCode } },
      session?.stateVersion,
      "candidate"
    );

    expect(sealResult.success).toBe(false);
    expect(sealResult.conflictState).toBe(SessionState.ACTIVE);

    // 2. Query database directly: MUST HAVE ZERO ROWS
    const dbArtifacts = await db
      .select()
      .from(submissionArtifacts)
      .where(eq(submissionArtifacts.sessionId, sessionId));

    expect(dbArtifacts.length).toBe(0);

    // 3. Test failed transition due to lease fencing (wrong worker UUID)
    // First, transition session to FINALIZING with worker "worker_alpha"
    await sessionRepo.atomicTransitionState(
      sessionId,
      [SessionState.ACTIVE],
      SessionState.FINALIZING,
      { finalizingBy: "worker_alpha", finalizingAt: new Date() }
    );

    const finalizingSession = await sessionRepo.findById(sessionId);
    expect(finalizingSession?.status).toBe(SessionState.FINALIZING);

    // Attempt sealing with worker "worker_beta" (superseded / invalid lease)
    const staleWorkerSeal = await submissionRepo.sealArtifactAndTransitionSession(
      artifact,
      { submittedAt: new Date(), workspaceSnapshot: { currentCode: artifact.finalCode } },
      finalizingSession?.stateVersion,
      "worker_beta" // WRONG WORKER
    );

    expect(staleWorkerSeal.success).toBe(false);

    // Assert again: database MUST STILL HAVE ZERO ROWS in submission_artifacts
    const dbArtifactsAfterStaleWorker = await db
      .select()
      .from(submissionArtifacts)
      .where(eq(submissionArtifacts.sessionId, sessionId));

    expect(dbArtifactsAfterStaleWorker.length).toBe(0);
  });

  // ==========================================================================
  // 3. Out-of-Order Autosaves Cannot Overwrite Newer Revisions
  // ==========================================================================
  it("Criterion 3: out-of-order autosaves cannot overwrite newer persisted revisions", async () => {
    const { sessionId, candidateToken } = await createCandidateSession("ooo_autosave@test.com", "OOO Candidate");

    // 1. Candidate sends Autosave 1 (clientRevision: 1, baseRevision: 0)
    const save1 = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const revisionOne = true;",
        clientRevision: 1,
        baseRevision: 0,
      },
    });
    expect(save1.statusCode).toBe(200);

    const dbAfterSave1 = await sessionRepo.findById(sessionId);
    expect(dbAfterSave1?.lastPersistedRevision).toBe(1);
    expect((dbAfterSave1?.workspaceSnapshot as any)?.currentCode).toBe("export const revisionOne = true;");

    // 2. Candidate sends Autosave 2 (clientRevision: 2, baseRevision: 1)
    const save2 = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const revisionTwo = true;",
        clientRevision: 2,
        baseRevision: 1,
      },
    });
    expect(save2.statusCode).toBe(200);

    const dbAfterSave2 = await sessionRepo.findById(sessionId);
    expect(dbAfterSave2?.lastPersistedRevision).toBe(2);
    expect((dbAfterSave2?.workspaceSnapshot as any)?.currentCode).toBe("export const revisionTwo = true;");

    // 3. Simulate delayed network arrival of older Autosave 1 payload (clientRevision: 1, baseRevision: 0)
    // Server must reject with HTTP 409 STALE_REVISION
    const staleSave = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const staleOldCode = true;",
        clientRevision: 1, // older than DB's revision 2
        baseRevision: 0,
      },
    });
    expect(staleSave.statusCode).toBe(409);
    const staleBody = JSON.parse(staleSave.body);
    expect(staleBody.error).toBe("STALE_REVISION");

    // 4. Assert database: code MUST STILL BE revisionTwo, revision MUST STILL BE 2
    const dbAfterStale = await sessionRepo.findById(sessionId);
    expect(dbAfterStale?.lastPersistedRevision).toBe(2);
    expect((dbAfterStale?.workspaceSnapshot as any)?.currentCode).toBe("export const revisionTwo = true;");
  });

  // ==========================================================================
  // 4. Every Candidate Write and AI Endpoint Enforces the Same Deadline Policy
  // ==========================================================================
  it("Criterion 4: every candidate write (workspace) and AI endpoint enforces the same deadline policy", async () => {
    const { sessionId, candidateToken } = await createCandidateSession("policy_align@test.com", "Policy Align Candidate");

    // Helper to test both endpoints in a given state
    const testBothEndpoints = async (expectedWorkspaceStatus: number, expectedAIStatus: number) => {
      // 1. Workspace autosave
      const wsRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/sessions/${sessionId}/workspace`,
        headers: { Authorization: `Bearer ${candidateToken}` },
        payload: { code: "export const probe = 1;" },
      });
      expect(wsRes.statusCode).toBe(expectedWorkspaceStatus);

      // 2. AI generate via query param
      const aiQueryRes = await app.inject({
        method: "POST",
        url: `/api/v1/answers/generate?sessionId=${sessionId}`,
        payload: {
          task: "debug",
          question: "How do I fix this comparator?",
          code: "export const probe = 1;",
        },
      });
      expect(aiQueryRes.statusCode).toBe(expectedAIStatus);

      // 3. AI generate via candidate Bearer JWT token (without ?sessionId in query)
      const aiTokenRes = await app.inject({
        method: "POST",
        url: "/api/v1/answers/generate",
        headers: { Authorization: `Bearer ${candidateToken}` },
        payload: {
          task: "debug",
          question: "How do I fix this comparator?",
          code: "export const probe = 1;",
        },
      });
      expect(aiTokenRes.statusCode).toBe(expectedAIStatus);
    };

    // A. PAUSED state: both must reject with 409 INVALID_STATE
    sessionService.pauseSession(sessionId, "Technical incident pause");
    await testBothEndpoints(409, 409);

    // Resume session back to ACTIVE
    sessionService.resumeSession(sessionId);

    // B. GRACE_PERIOD state: both must reject with 410 SESSION_EXPIRED
    await sessionRepo.atomicTransitionState(sessionId, [SessionState.ACTIVE], SessionState.GRACE_PERIOD);
    const sessionGrace = sessionService.getSession(sessionId);
    sessionGrace.status = SessionState.GRACE_PERIOD;
    await testBothEndpoints(410, 410);

    // C. FINALIZING state: both must reject with 409 INVALID_STATE
    await sessionRepo.atomicTransitionState(sessionId, [SessionState.GRACE_PERIOD], SessionState.FINALIZING);
    const sessionFin = sessionService.getSession(sessionId);
    sessionFin.status = SessionState.FINALIZING;
    await testBothEndpoints(409, 409);

    // D. SUBMITTED state: both must reject with 409 INVALID_STATE
    await sessionRepo.atomicTransitionState(sessionId, [SessionState.FINALIZING], SessionState.SUBMITTED);
    const sessionSub = sessionService.getSession(sessionId);
    sessionSub.status = SessionState.SUBMITTED;
    await testBothEndpoints(409, 409);
  });

  // ==========================================================================
  // 5. Two Independent API Processes Cannot Create Conflicting Snapshots
  // ==========================================================================
  it("Criterion 5: two independent API processes cannot create conflicting snapshots from the same base revision", async () => {
    const { sessionId, candidateToken } = await createCandidateSession("race_process@test.com", "Race Process Candidate");

    // Establish base revision 1
    const initSave = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      headers: { Authorization: `Bearer ${candidateToken}` },
      payload: {
        code: "export const initialCode = true;",
        clientRevision: 1,
        baseRevision: 0,
      },
    });
    expect(initSave.statusCode).toBe(200);

    // Simulate two concurrent requests arriving from two different client instances / network paths
    // Both attempt to update from baseRevision: 1 simultaneously:
    // Process Alpha proposes code "Alpha Code" (clientRevision: 2, baseRevision: 1)
    // Process Beta proposes code "Beta Code" (clientRevision: 2, baseRevision: 1)
    const [alphaRes, betaRes] = await Promise.all([
      app.inject({
        method: "PATCH",
        url: `/api/v1/sessions/${sessionId}/workspace`,
        headers: { Authorization: `Bearer ${candidateToken}` },
        payload: {
          code: "export const alphaCode = true;",
          clientRevision: 2,
          baseRevision: 1,
        },
      }),
      app.inject({
        method: "PATCH",
        url: `/api/v1/sessions/${sessionId}/workspace`,
        headers: { Authorization: `Bearer ${candidateToken}` },
        payload: {
          code: "export const betaCode = true;",
          clientRevision: 2,
          baseRevision: 1,
        },
      }),
    ]);

    const statusCodes = [alphaRes.statusCode, betaRes.statusCode].sort();
    // Exactly ONE must succeed (200) and exactly ONE must be rejected with STALE_REVISION (409)
    expect(statusCodes).toEqual([200, 409]);

    const winningCode = alphaRes.statusCode === 200
      ? "export const alphaCode = true;"
      : "export const betaCode = true;";

    // Database must reflect the winning process's code cleanly with lastPersistedRevision = 2
    const finalDb = await sessionRepo.findById(sessionId);
    expect(finalDb?.lastPersistedRevision).toBe(2);
    expect((finalDb?.workspaceSnapshot as any)?.currentCode).toBe(winningCode);
  });
});
