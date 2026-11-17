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

describe("LOOP 10.0.4.2: Deadline Enforcement & Finalization Contract Suite", () => {
  let app: FastifyInstance;
  let sessionService: AssessmentSessionService;
  let submissionService: SubmissionService;
  let sessionRepo: SessionRepository;
  let submissionRepo: SubmissionRepository;
  const jwtSecret = "loop-10-0-4-2-contract-test-secret-key-32";
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

  async function createCandidateSession(candidateEmail = "cand@test.com", candidateName = "Alex Candidate") {
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
    };
  }

  // --------------------------------------------------------------------------
  // 1. Autosave after deadline but before expiry sweep
  // --------------------------------------------------------------------------
  it("Test 1: strictly rejects autosaves after editing deadline even before background expiry sweep runs", async () => {
    const { sessionId } = await createCandidateSession("post_deadline@test.com", "Post Deadline");

    // Save initial valid code
    await sessionService.updateWorkspaceCodeAsync(sessionId, { code: "export const legitimateCode = 1;" });

    // Simulate clock passing expiresAt by mutating expiresAt 5 seconds into the past
    // Note: status in DB remains 'ACTIVE', simulating the window BEFORE background sweep
    const pastDate = new Date(Date.now() - 5000);
    const session = sessionService.getSession(sessionId);
    session.expiresAt = pastDate;
    await sessionRepo.update(sessionId, { expiresAt: pastDate });

    // Candidate client attempts autosave via HTTP endpoint
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      payload: { code: "export const illegalLateCode = 999;" },
    });

    // Must be rejected with 410 SESSION_EXPIRED
    expect(patchRes.statusCode).toBe(410);
    expect(patchRes.json().error).toBe("SESSION_EXPIRED");

    // Verify DB was NOT mutated by the late autosave
    const dbSession = await sessionRepo.findById(sessionId);
    expect(dbSession?.workspaceSnapshot.currentCode).toBe("export const legitimateCode = 1;");
  });

  // --------------------------------------------------------------------------
  // 2. Autosave racing ACTIVE -> GRACE_PERIOD
  // --------------------------------------------------------------------------
  it("Test 2: handles race between candidate autosave and server ACTIVE -> GRACE_PERIOD transition", async () => {
    const { sessionId } = await createCandidateSession("race_grace@test.com", "Race Grace");

    await sessionService.updateWorkspaceCodeAsync(sessionId, { code: "export const validWork = true;" });

    // Transition to GRACE_PERIOD in DB
    await sessionRepo.atomicTransitionState(
      sessionId,
      [SessionState.ACTIVE],
      SessionState.GRACE_PERIOD
    );

    // Direct database write must be rejected by conditional guard
    const guardedResult = await sessionRepo.updateWorkspaceSnapshot(sessionId, {
      currentCode: "export const lateHack = false;",
      lastSavedAt: new Date(),
      revision: 99,
    });
    expect(guardedResult).toBeNull();

    // Verify DB still holds valid work
    const dbSession = await sessionRepo.findById(sessionId);
    expect(dbSession?.workspaceSnapshot.currentCode).toBe("export const validWork = true;");
  });

  // --------------------------------------------------------------------------
  // 3. Autosave racing ACTIVE -> FINALIZING
  // --------------------------------------------------------------------------
  it("Test 3: handles race between candidate autosave and ACTIVE -> FINALIZING transition", async () => {
    const { sessionId } = await createCandidateSession("race_final@test.com", "Race Finalizing");

    await sessionService.updateWorkspaceCodeAsync(sessionId, { code: "export const preFinalCode = 1;" });

    // Session transitions to FINALIZING (e.g. candidate buzzer submit or expiry processor)
    await sessionRepo.atomicTransitionState(
      sessionId,
      [SessionState.ACTIVE],
      SessionState.FINALIZING,
      { finalizingAt: new Date(), finalizingBy: "candidate" }
    );

    // Concurrently arriving autosave must be rejected
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      payload: { code: "export const injectedLateCode = 2;" },
    });

    expect([409, 410]).toContain(patchRes.statusCode);

    // DB code remains preFinalCode
    const dbSession = await sessionRepo.findById(sessionId);
    expect(dbSession?.workspaceSnapshot.currentCode).toBe("export const preFinalCode = 1;");
  });

  // --------------------------------------------------------------------------
  // 4. Paused and resumed session deadline calculations
  // --------------------------------------------------------------------------
  it("Test 4: preserves and extends authoritative deadline across proctor pause and resume", async () => {
    const { sessionId } = await createCandidateSession("pause_resume@test.com", "Pause Resume");

    const initialDb = await sessionRepo.findById(sessionId);
    const initialExpiresAt = new Date(initialDb!.expiresAt).getTime();

    // 1. Proctor pauses session
    sessionService.pauseSession(sessionId, "Hardware failure incident");
    const pausedDb = await sessionRepo.findById(sessionId);
    expect(pausedDb?.status).toBe(SessionState.PAUSED);

    // Autosaves while paused must be rejected
    const pausePatch = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      payload: { code: "export const whilePaused = false;" },
    });
    expect(pausePatch.statusCode).toBe(409);

    // 2. Simulate 15 seconds incident duration
    const session = sessionService.getSession(sessionId);
    session.pausedAt = new Date(Date.now() - 15000);

    // 3. Proctor resumes session
    sessionService.resumeSession(sessionId);
    const resumedDb = await sessionRepo.findById(sessionId);
    expect(resumedDb?.status).toBe(SessionState.ACTIVE);

    // Authoritative deadline in DB must be extended
    const newExpiresAt = new Date(resumedDb!.expiresAt).getTime();
    expect(newExpiresAt).toBeGreaterThanOrEqual(initialExpiresAt + 14000);

    // Autosave after resume is accepted
    const resumePatch = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      payload: { code: "export const afterResume = true;" },
    });
    expect(resumePatch.statusCode).toBe(200);
  });

  // --------------------------------------------------------------------------
  // 5. Sealing rejected from ACTIVE
  // --------------------------------------------------------------------------
  it("Test 5: strictly rejects direct artifact sealing when session is in ACTIVE state", async () => {
    const { sessionId } = await createCandidateSession("seal_active@test.com", "Seal Active");

    const session = await sessionRepo.findById(sessionId);
    expect(session?.status).toBe(SessionState.ACTIVE);

    const artifact: SubmissionArtifact = {
      id: `sub_direct_active_${Date.now()}`,
      sessionId,
      organizationId: orgId,
      templateId,
      candidateName: "Seal Active",
      candidateEmail: "seal_active@test.com",
      submittedAt: new Date(),
      finalCode: "export const code = 1;",
      starterCode: "// starter",
      codeDiff: { additions: 1, deletions: 0, totalChanges: 1, unifiedDiff: "" },
      testExecutionLog: { success: true, passed: true, passedCount: 1, totalCount: 1, durationMs: 10, tests: [], exitCode: 0 },
      technicalExplanation: "Direct submit attempt from ACTIVE",
      telemetrySummary: { totalEvents: 0, aiQueriesCount: 0, consumedAiBudgetUsd: 0, patchDecisions: { accepted: 0, rejected: 0 }, attentionMetrics: { blurCount: 0, pasteCount: 0 } },
      templateContentHash: "a".repeat(64),
      submissionFingerprint: "b".repeat(64),
    };

    // Direct sealing from ACTIVE without claiming FINALIZING must fail
    const sealResult = await submissionRepo.sealArtifactAndTransitionSession(
      artifact,
      { submittedAt: new Date(), workspaceSnapshot: { currentCode: artifact.finalCode } },
      session?.stateVersion,
      "candidate"
    );

    expect(sealResult.success).toBe(false);
    expect(sealResult.conflictState).toBe(SessionState.ACTIVE);

    // No artifact created
    const saved = await submissionRepo.findBySessionId(sessionId);
    expect(saved).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 6. Sealing rejected from GRACE_PERIOD
  // --------------------------------------------------------------------------
  it("Test 6: strictly rejects direct artifact sealing when session is in GRACE_PERIOD state", async () => {
    const { sessionId } = await createCandidateSession("seal_grace@test.com", "Seal Grace");

    // Transition to GRACE_PERIOD
    await sessionRepo.atomicTransitionState(sessionId, [SessionState.ACTIVE], SessionState.GRACE_PERIOD);
    const session = await sessionRepo.findById(sessionId);
    expect(session?.status).toBe(SessionState.GRACE_PERIOD);

    const artifact: SubmissionArtifact = {
      id: `sub_direct_grace_${Date.now()}`,
      sessionId,
      organizationId: orgId,
      templateId,
      candidateName: "Seal Grace",
      candidateEmail: "seal_grace@test.com",
      submittedAt: new Date(),
      finalCode: "export const code = 2;",
      starterCode: "// starter",
      codeDiff: { additions: 1, deletions: 0, totalChanges: 1, unifiedDiff: "" },
      testExecutionLog: { success: true, passed: true, passedCount: 1, totalCount: 1, durationMs: 10, tests: [], exitCode: 0 },
      technicalExplanation: "Direct submit attempt from GRACE_PERIOD",
      telemetrySummary: { totalEvents: 0, aiQueriesCount: 0, consumedAiBudgetUsd: 0, patchDecisions: { accepted: 0, rejected: 0 }, attentionMetrics: { blurCount: 0, pasteCount: 0 } },
      templateContentHash: "a".repeat(64),
      submissionFingerprint: "c".repeat(64),
    };

    // Direct sealing from GRACE_PERIOD must fail
    const sealResult = await submissionRepo.sealArtifactAndTransitionSession(
      artifact,
      { submittedAt: new Date(), workspaceSnapshot: { currentCode: artifact.finalCode } },
      session?.stateVersion,
      "candidate"
    );

    expect(sealResult.success).toBe(false);
    expect(sealResult.conflictState).toBe(SessionState.GRACE_PERIOD);

    const saved = await submissionRepo.findBySessionId(sessionId);
    expect(saved).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 7. Stale finalization lease rejected
  // --------------------------------------------------------------------------
  it("Test 7: strictly rejects artifact sealing when finalization lease is stale or superseded", async () => {
    const { sessionId } = await createCandidateSession("stale_lease@test.com", "Stale Lease");

    // Worker 1 claims lease
    const w1 = await sessionRepo.atomicTransitionState(
      sessionId,
      [SessionState.ACTIVE],
      SessionState.FINALIZING,
      { finalizingAt: new Date(Date.now() - 60000), finalizingBy: "worker_1" }
    );
    expect(w1.success).toBe(true);

    // Worker 2 supersedes lease after timeout
    const w2 = await sessionRepo.atomicTransitionState(
      sessionId,
      [SessionState.FINALIZING],
      SessionState.FINALIZING,
      { finalizingAt: new Date(), finalizingBy: "worker_2" }
    );
    expect(w2.success).toBe(true);

    const artifact: SubmissionArtifact = {
      id: `sub_stale_${Date.now()}`,
      sessionId,
      organizationId: orgId,
      templateId,
      candidateName: "Stale Lease",
      candidateEmail: "stale_lease@test.com",
      submittedAt: new Date(),
      finalCode: "export const stale = true;",
      starterCode: "// starter",
      codeDiff: { additions: 1, deletions: 0, totalChanges: 1, unifiedDiff: "" },
      testExecutionLog: { success: true, passed: true, passedCount: 1, totalCount: 1, durationMs: 10, tests: [], exitCode: 0 },
      technicalExplanation: "Worker 1 stale attempt",
      telemetrySummary: { totalEvents: 0, aiQueriesCount: 0, consumedAiBudgetUsd: 0, patchDecisions: { accepted: 0, rejected: 0 }, attentionMetrics: { blurCount: 0, pasteCount: 0 } },
      templateContentHash: "a".repeat(64),
      submissionFingerprint: "d".repeat(64),
    };

    // Worker 1 attempts sealing with stale token and version
    const staleResult = await submissionRepo.sealArtifactAndTransitionSession(
      artifact,
      { submittedAt: new Date(), workspaceSnapshot: { currentCode: artifact.finalCode } },
      w1.session?.stateVersion,
      "worker_1"
    );

    expect(staleResult.success).toBe(false);

    // Artifact was NOT persisted
    const saved = await submissionRepo.findBySessionId(sessionId);
    expect(saved).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 8. Valid FINALIZING -> SUBMITTED transition
  // --------------------------------------------------------------------------
  it("Test 8: completes valid atomic FINALIZING -> SUBMITTED transition with matching lease token", async () => {
    const { sessionId } = await createCandidateSession("valid_trans@test.com", "Valid Transition");

    // Stage 1: Transition to FINALIZING
    const claim = await sessionRepo.atomicTransitionState(
      sessionId,
      [SessionState.ACTIVE],
      SessionState.FINALIZING,
      { finalizingAt: new Date(), finalizingBy: "authoritative_worker" }
    );
    expect(claim.success).toBe(true);

    const artifact: SubmissionArtifact = {
      id: `sub_valid_${Date.now()}`,
      sessionId,
      organizationId: orgId,
      templateId,
      candidateName: "Valid Transition",
      candidateEmail: "valid_trans@test.com",
      submittedAt: new Date(),
      finalCode: "export const valid = true;",
      starterCode: "// starter",
      codeDiff: { additions: 1, deletions: 0, totalChanges: 1, unifiedDiff: "" },
      testExecutionLog: { success: true, passed: true, passedCount: 1, totalCount: 1, durationMs: 10, tests: [], exitCode: 0 },
      technicalExplanation: "Authoritative submission",
      telemetrySummary: { totalEvents: 0, aiQueriesCount: 0, consumedAiBudgetUsd: 0, patchDecisions: { accepted: 0, rejected: 0 }, attentionMetrics: { blurCount: 0, pasteCount: 0 } },
      templateContentHash: "a".repeat(64),
      submissionFingerprint: "e".repeat(64),
    };

    // Stage 2: Transactional sealing
    const sealResult = await submissionRepo.sealArtifactAndTransitionSession(
      artifact,
      { submittedAt: new Date(), workspaceSnapshot: { currentCode: artifact.finalCode } },
      claim.session?.stateVersion,
      "authoritative_worker"
    );

    expect(sealResult.success).toBe(true);

    // Verify DB state is SUBMITTED
    const dbSession = await sessionRepo.findById(sessionId);
    expect(dbSession?.status).toBe(SessionState.SUBMITTED);

    // Verify artifact is retrievable
    const saved = await submissionRepo.findBySessionId(sessionId);
    expect(saved?.id).toBe(artifact.id);
  });

  // --------------------------------------------------------------------------
  // 9. Runner disabled result cannot look like a successful test run
  // --------------------------------------------------------------------------
  it("Test 9: returns explicit NOT_RUN status and null exitCode when runner execution is disabled", async () => {
    const { sessionId } = await createCandidateSession("not_run@test.com", "Not Run Candidate");

    const origEnv = process.env.RUNNER_EXECUTION_ENABLED;
    process.env.RUNNER_EXECUTION_ENABLED = "false";

    try {
      const artifact = await submissionService.submitAssessment(sessionId, {
        finalCode: "export const code = 'clean_submission';",
        technicalExplanation: "Submission while runner execution is disabled.",
      });

      // Status must be NOT_RUN
      expect(artifact.testExecutionLog.status).toBe("NOT_RUN");
      expect(artifact.testExecutionLog.statusReason).toContain("Automated test execution disabled");

      // Passed must be null (neither true nor false)
      expect(artifact.testExecutionLog.passed).toBeNull();

      // exitCode must be null (NOT 0!)
      expect(artifact.testExecutionLog.exitCode).toBeNull();

      // Counts must be 0
      expect(artifact.testExecutionLog.passedCount).toBe(0);
      expect(artifact.testExecutionLog.totalCount).toBe(0);

      // Submission itself succeeded and evidence is preserved
      expect(artifact.finalCode).toBe("export const code = 'clean_submission';");
      expect(artifact.submissionFingerprint).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      process.env.RUNNER_EXECUTION_ENABLED = origEnv;
    }
  });

  // --------------------------------------------------------------------------
  // 10. Runner unavailable does not cause candidate submission loss
  // --------------------------------------------------------------------------
  it("Test 10: gracefully seals submission artifact with UNAVAILABLE status when runner infrastructure fails", async () => {
    const { sessionId } = await createCandidateSession("runner_unavail@test.com", "Runner Unavail");

    // Force sandbox error by mocking internal runner client
    const runnerClient = (submissionService as any)["executeSandboxSafely"];
    (submissionService as any)["executeSandboxSafely"] = async () => ({
      status: "UNAVAILABLE" as const,
      statusReason: "Dedicated Code Runner Daemon unreachable at http://127.0.0.1:4100",
      success: false,
      passed: null,
      passedCount: 0,
      totalCount: 0,
      tests: [],
      durationMs: 0,
      stdout: "",
      stderr: "Automated verification unavailable: network timeout. Candidate code preserved for reviewer evaluation.",
      exitCode: null,
    });

    try {
      const artifact = await submissionService.submitAssessment(sessionId, {
        finalCode: "export const preservedWork = 'safe_in_db';",
        technicalExplanation: "Candidate submission during infrastructure outage.",
      });

      // Submission did not crash and returned valid artifact
      expect(artifact).toBeDefined();
      expect(artifact.testExecutionLog.status).toBe("UNAVAILABLE");
      expect(artifact.testExecutionLog.passed).toBeNull();
      expect(artifact.testExecutionLog.exitCode).toBeNull();
      expect(artifact.finalCode).toBe("export const preservedWork = 'safe_in_db';");

      // Session transitioned to SUBMITTED
      const dbSession = await sessionRepo.findById(sessionId);
      expect(dbSession?.status).toBe(SessionState.SUBMITTED);
    } finally {
      (submissionService as any)["executeSandboxSafely"] = runnerClient;
    }
  });

  // --------------------------------------------------------------------------
  // 11. Exactly one logical artifact under concurrent requests
  // --------------------------------------------------------------------------
  it("Test 11: guarantees exactly ONE logical artifact created under rapid concurrent submit requests", async () => {
    const { sessionId } = await createCandidateSession("concurrent_submits@test.com", "Concurrent Submits");

    // Fire 5 simultaneous submit requests
    const submissions = await Promise.all([
      submissionService.submitAssessment(sessionId, { finalCode: "export const c = 1;", technicalExplanation: "Sub 1" }),
      submissionService.submitAssessment(sessionId, { finalCode: "export const c = 2;", technicalExplanation: "Sub 2" }),
      submissionService.submitAssessment(sessionId, { finalCode: "export const c = 3;", technicalExplanation: "Sub 3" }),
      submissionService.submitAssessment(sessionId, { finalCode: "export const c = 4;", technicalExplanation: "Sub 4" }),
      submissionService.submitAssessment(sessionId, { finalCode: "export const c = 5;", technicalExplanation: "Sub 5" }),
    ]);

    // All 5 callers must receive the exact same artifact ID and fingerprint
    const firstId = submissions[0].id;
    const firstFingerprint = submissions[0].submissionFingerprint;
    for (const sub of submissions) {
      expect(sub.id).toBe(firstId);
      expect(sub.submissionFingerprint).toBe(firstFingerprint);
    }

    // Database must contain exactly 1 artifact for this session
    const dbArtifact = await submissionRepo.findBySessionId(sessionId);
    expect(dbArtifact).toBeDefined();
    expect(dbArtifact?.id).toBe(firstId);
  });
});
