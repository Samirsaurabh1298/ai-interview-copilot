import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import {
  SessionState,
  SessionExpiredError,
  SessionLockedError,
  type SubmissionArtifact,
} from "@ai-copilot/contracts";
import type { AssessmentSessionService } from "./session.js";
import type { SubmissionService } from "./submission.js";
import type { SessionRepository } from "../repositories/session.repo.js";
import type { SubmissionRepository } from "../repositories/submission.repo.js";

describe("LOOP 10.0.4.1: FSM Reliability Acceptance Suite", () => {
  let app: FastifyInstance;
  let sessionService: AssessmentSessionService;
  let submissionService: SubmissionService;
  let sessionRepo: SessionRepository;
  let submissionRepo: SubmissionRepository;
  const jwtSecret = "loop-10-0-4-fsm-reliability-test-secret-32";
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

    // Retrieve seeded organization and template
    const orgRes = await app.inject({
      method: "GET",
      url: "/api/v1/organizations",
    });
    const { organizations } = JSON.parse(orgRes.body);
    orgId = organizations[0].id;

    const tmplRes = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgId}`,
    });
    const { templates } = JSON.parse(tmplRes.body);
    templateId = templates[0].id;

    const authRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: orgId, email: "priya@acme.corp" },
    });
    adminToken = JSON.parse(authRes.body).token;

    // Use authoritative app services
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

  // ==========================================================================
  // 1. Lease Fencing Verification
  // ==========================================================================
  it("Criterion 1 [Lease Fencing]: prevents stale worker from completing finalization when lease superseded", async () => {
    const { sessionId } = await createCandidateSession("lease_fence@test.com", "Lease Fence Candidate");

    // Initial state: ACTIVE, state_version = 1
    const initialSession = await sessionRepo.findById(sessionId);
    expect(initialSession?.status).toBe(SessionState.ACTIVE);
    const initialVersion = initialSession?.stateVersion ?? 1;

    // 1. Worker A claims the finalization lease (ACTIVE -> FINALIZING)
    const workerAClaim = await sessionRepo.atomicTransitionState(
      sessionId,
      [SessionState.ACTIVE],
      SessionState.FINALIZING,
      {
        finalizingAt: new Date(Date.now() - 60000), // Simulated slow worker (claimed 60s ago)
        finalizingBy: "worker_instance_A_pid_1001",
      },
      initialVersion
    );
    expect(workerAClaim.success).toBe(true);
    const workerAVersion = workerAClaim.session?.stateVersion;
    expect(workerAVersion).toBeDefined();

    // 2. Recovery Worker B detects lease timeout and claims recovery lease (FINALIZING -> FINALIZING)
    const workerBClaim = await sessionRepo.atomicTransitionState(
      sessionId,
      [SessionState.FINALIZING],
      SessionState.FINALIZING,
      {
        finalizingAt: new Date(),
        finalizingBy: "recovery_worker_B_pid_2002",
      },
      workerAVersion // CAS check on Worker A's version
    );
    expect(workerBClaim.success).toBe(true);
    const workerBVersion = workerBClaim.session?.stateVersion;
    expect(workerBVersion).toBeGreaterThan(workerAVersion!);

    // 3. Stale Worker A wakes up and attempts to complete finalization using its stale version
    const staleArtifact: SubmissionArtifact = {
      id: `sub_stale_${Date.now()}`,
      sessionId,
      organizationId: orgId,
      templateId,
      candidateName: "Lease Fence Candidate",
      candidateEmail: "lease_fence@test.com",
      submittedAt: new Date(),
      finalCode: "export function staleCode() { return 'worker_A'; }",
      starterCode: "// starter",
      codeDiff: { addedLines: 1, removedLines: 0, totalChanges: 1, patch: "" },
      testExecutionLog: { passed: false, tests: [] },
      technicalExplanation: "Stale submission from Worker A",
      telemetrySummary: { totalEvents: 0, aiQueriesCount: 0, attentionMetrics: { blurCount: 0, pasteCount: 0 } },
      templateContentHash: "0".repeat(64),
      submissionFingerprint: "a".repeat(64),
    };

    const staleSealResult = await submissionRepo.sealArtifactAndTransitionSession(
      staleArtifact,
      {
        submittedAt: new Date(),
        workspaceSnapshot: { currentCode: staleArtifact.finalCode },
      },
      workerAVersion // Fenced with stale version
    );

    // Stale Worker A MUST be fenced out
    expect(staleSealResult.success).toBe(false);

    // Verify no artifact was created by Worker A
    const artifactAfterStaleAttempt = await submissionRepo.findBySessionId(sessionId);
    expect(artifactAfterStaleAttempt).toBeNull();

    // 4. Authoritative Recovery Worker B completes finalization using its valid version
    const validArtifact: SubmissionArtifact = {
      id: `sub_valid_${Date.now()}`,
      sessionId,
      organizationId: orgId,
      templateId,
      candidateName: "Lease Fence Candidate",
      candidateEmail: "lease_fence@test.com",
      submittedAt: new Date(),
      finalCode: "export function authoritativeCode() { return 'worker_B'; }",
      starterCode: "// starter",
      codeDiff: { addedLines: 1, removedLines: 0, totalChanges: 1, patch: "" },
      testExecutionLog: { passed: true, tests: [] },
      technicalExplanation: "Authoritative submission from Recovery Worker B",
      telemetrySummary: { totalEvents: 0, aiQueriesCount: 0, attentionMetrics: { blurCount: 0, pasteCount: 0 } },
      templateContentHash: "0".repeat(64),
      submissionFingerprint: "b".repeat(64),
    };

    const validSealResult = await submissionRepo.sealArtifactAndTransitionSession(
      validArtifact,
      {
        submittedAt: new Date(),
        workspaceSnapshot: { currentCode: validArtifact.finalCode },
      },
      workerBVersion
    );
    expect(validSealResult.success).toBe(true);

    // 5. Verify database state is SUBMITTED and matches Worker B's authoritative work
    const finalizedDbSession = await sessionRepo.findById(sessionId);
    expect(finalizedDbSession?.status).toBe(SessionState.SUBMITTED);

    const savedArtifact = await submissionRepo.findBySessionId(sessionId);
    expect(savedArtifact?.id).toBe(validArtifact.id);
    expect(savedArtifact?.finalCode).toBe(validArtifact.finalCode);
  });

  // ==========================================================================
  // 2. Atomic Autosave Guards Verification
  // ==========================================================================
  it("Criterion 2 [Atomic Autosave Guards]: strictly rejects workspace writes when session is not in ACTIVE state", async () => {
    const { sessionId } = await createCandidateSession("autosave_guard@test.com", "Autosave Candidate");

    // 1. In ACTIVE state, autosaves persist and increment revision
    const activeUpdate = await sessionService.updateWorkspaceCodeAsync(sessionId, {
      code: "export function activeCode() { return 1; }",
    });
    expect(activeUpdate.workspaceSnapshot.currentCode).toBe("export function activeCode() { return 1; }");
    expect(activeUpdate.lastPersistedRevision).toBe(1);

    const dbActive = await sessionRepo.findById(sessionId);
    expect(dbActive?.workspaceSnapshot.currentCode).toBe("export function activeCode() { return 1; }");
    expect(dbActive?.lastPersistedRevision).toBe(1);

    // 2. Transition session to GRACE_PERIOD in DB
    await sessionRepo.atomicTransitionState(
      sessionId,
      [SessionState.ACTIVE],
      SessionState.GRACE_PERIOD
    );

    // Direct DB level guard check: updateWorkspaceSnapshot must return null when session is in GRACE_PERIOD
    const lateSnapshot = {
      currentCode: "export function lateHack() { return 999; }",
      lastSavedAt: new Date(),
      revision: 2,
    };
    const dbGuardedResult = await sessionRepo.updateWorkspaceSnapshot(sessionId, lateSnapshot);
    expect(dbGuardedResult).toBeNull();

    // Verify DB still holds candidate's legitimate active code
    const dbAfterBlockedSave = await sessionRepo.findById(sessionId);
    expect(dbAfterBlockedSave?.workspaceSnapshot.currentCode).toBe("export function activeCode() { return 1; }");
    expect(dbAfterBlockedSave?.lastPersistedRevision).toBe(1);

    // 3. HTTP route / service level check: assertCanCode / updateWorkspaceCodeAsync throws 410 SESSION_EXPIRED
    await expect(
      sessionService.updateWorkspaceCodeAsync(sessionId, { code: "export function lateHack() { return 999; }" })
    ).rejects.toThrow(SessionExpiredError);

    // 4. HTTP endpoint invocation returns 410
    const httpRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      payload: { code: "export function lateHack() { return 999; }" },
    });
    expect(httpRes.statusCode).toBe(410);
    const body = httpRes.json();
    expect(body.error).toBe("SESSION_EXPIRED");
  });

  // ==========================================================================
  // 3. Sandbox-Disabled Finalization Verification
  // ==========================================================================
  it("Criterion 3 [Sandbox-Disabled Finalization]: finalizes and seals artifact gracefully when runner execution is disabled", async () => {
    const { sessionId } = await createCandidateSession("sandbox_disabled@test.com", "Sandbox Disabled Candidate");

    // Candidate persists working code
    const candidateCode = "export function solveChallenge() { return 'completed_without_runner'; }";
    await sessionService.updateWorkspaceCodeAsync(sessionId, { code: candidateCode });

    // Explicitly disable runner execution via environment flag
    const originalFlag = process.env.RUNNER_EXECUTION_ENABLED;
    process.env.RUNNER_EXECUTION_ENABLED = "false";

    try {
      // Finalize session via SubmissionService
      const artifact = await submissionService.submitAssessment(sessionId, {
        finalCode: candidateCode,
        technicalExplanation: "Solution submitted while runner execution is disabled.",
        finalizedBy: "candidate",
      });

      // 1. Finalization must succeed with 200 / valid artifact
      expect(artifact).toBeDefined();
      expect(artifact.finalCode).toBe(candidateCode);
      expect(artifact.submissionFingerprint).toMatch(/^[a-f0-9]{64}$/);

      // 2. Test execution log indicates disabled execution without representing it as passed or failed
      expect(artifact.testExecutionLog.status).toBe("NOT_RUN");
      expect(artifact.testExecutionLog.passed).toBeNull();
      expect(artifact.testExecutionLog.exitCode).toBeNull();
      expect(artifact.testExecutionLog.stderr).toContain("Automated sandbox verification disabled");

      // 3. Session must be cleanly transitioned to SUBMITTED
      const session = sessionService.getSession(sessionId);
      expect(session.status).toBe(SessionState.SUBMITTED);

      const dbSession = await sessionRepo.findById(sessionId);
      expect(dbSession?.status).toBe(SessionState.SUBMITTED);
    } finally {
      process.env.RUNNER_EXECUTION_ENABLED = originalFlag;
    }
  });

  // ==========================================================================
  // 4. Transactional Artifact Sealing Verification
  // ==========================================================================
  it("Criterion 4 [Transactional Sealing]: guarantees artifact creation and status transition occur atomically", async () => {
    const { sessionId } = await createCandidateSession("tx_seal@test.com", "Tx Seal Candidate");

    // Transition to FINALIZING
    const claimRes = await sessionRepo.atomicTransitionState(
      sessionId,
      [SessionState.ACTIVE],
      SessionState.FINALIZING,
      { finalizingAt: new Date(), finalizingBy: "tx_tester" }
    );
    expect(claimRes.success).toBe(true);
    const version = claimRes.session?.stateVersion;

    const artifact: SubmissionArtifact = {
      id: `sub_tx_${Date.now()}`,
      sessionId,
      organizationId: orgId,
      templateId,
      candidateName: "Tx Seal Candidate",
      candidateEmail: "tx_seal@test.com",
      submittedAt: new Date(),
      finalCode: "export const txWork = 42;",
      starterCode: "// starter",
      codeDiff: { addedLines: 1, removedLines: 0, totalChanges: 1, patch: "" },
      testExecutionLog: { passed: true, tests: [] },
      technicalExplanation: "Atomically sealed submission artifact.",
      telemetrySummary: { totalEvents: 1, aiQueriesCount: 0, attentionMetrics: { blurCount: 0, pasteCount: 0 } },
      templateContentHash: "f".repeat(64),
      submissionFingerprint: "e".repeat(64),
    };

    // Execute atomic transaction
    const sealResult = await submissionRepo.sealArtifactAndTransitionSession(
      artifact,
      {
        submittedAt: new Date(),
        workspaceSnapshot: { currentCode: artifact.finalCode },
      },
      version
    );

    expect(sealResult.success).toBe(true);
    expect(sealResult.artifact.id).toBe(artifact.id);

    // Verify both artifact exists AND session is SUBMITTED
    const dbArtifact = await submissionRepo.findBySessionId(sessionId);
    expect(dbArtifact).toBeDefined();
    expect(dbArtifact?.id).toBe(artifact.id);

    const dbSession = await sessionRepo.findById(sessionId);
    expect(dbSession?.status).toBe(SessionState.SUBMITTED);
    expect(dbSession?.submittedAt).toBeDefined();

    // Idempotent retry returns existing artifact
    const retrySeal = await submissionRepo.sealArtifactAndTransitionSession(
      artifact,
      {
        submittedAt: new Date(),
        workspaceSnapshot: { currentCode: artifact.finalCode },
      },
      version
    );
    expect(retrySeal.success).toBe(true);
    expect(retrySeal.artifact.id).toBe(artifact.id);
  });
});
