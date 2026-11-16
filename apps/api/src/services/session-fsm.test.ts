import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { AuthService } from "./auth.js";
import { AssessmentSessionService } from "./session.js";
import { SubmissionService } from "./submission.js";
import { SessionExpiryProcessor } from "./session-expiry-processor.js";
import { AssessmentTemplateService } from "./template.js";
import { OrganizationService } from "./organization.js";
import { AIUsageGatewayService } from "./gateway.js";
import { SessionEventsService } from "./session-events.js";
import { SessionRepository } from "../repositories/session.repo.js";
import { SubmissionRepository } from "../repositories/submission.repo.js";
import { SessionState } from "@ai-copilot/contracts";

describe("LOOP 10.0.4: Assessment Lifecycle State Machine, CAS & Concurrency Suite", () => {
  let app: FastifyInstance;
  let authService: AuthService;
  let sessionService: AssessmentSessionService;
  let submissionService: SubmissionService;
  let expiryProcessor: SessionExpiryProcessor;
  let sessionRepo: SessionRepository;
  let submissionRepo: SubmissionRepository;

  const jwtSecret = "loop-10-0-4-fsm-concurrency-test-secret-key-32";
  let orgId: string;
  let adminToken: string;
  let templateId: string;

  beforeAll(async () => {
    authService = new AuthService(jwtSecret);

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

    // 1. Retrieve seeded organization & template
    const orgRes = await app.inject({ method: "GET", url: "/api/v1/organizations" });
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
    expiryProcessor = (app as any).expiryProcessor;
    sessionRepo = sessionService.getRepo();
    submissionRepo = submissionService["repo"];
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
  // 1. Two API instances attempting finalization concurrently (Database CAS)
  // --------------------------------------------------------------------------
  it("Test 1: guarantees exactly ONE finalization when two API instances finalize concurrently", async () => {
    const { sessionId } = await createCandidateSession("inst_race@test.com", "Concurrent Candidate");

    // Seed session in memory service
    const session = sessionService.getSession(sessionId);
    session.workspaceSnapshot.currentCode = "export const solution = 'concurrency_proof';";

    // Simulate two distinct API service instances sharing the same database
    const instanceA = new SubmissionService(sessionService, sessionService["templateService"], sessionService["eventsService"]!, submissionRepo, undefined, sessionRepo);
    const instanceB = new SubmissionService(sessionService, sessionService["templateService"], sessionService["eventsService"]!, submissionRepo, undefined, sessionRepo);

    // Concurrently trigger finalization from both instances
    const [resultA, resultB] = await Promise.all([
      instanceA.submitAssessment(sessionId, {
        finalCode: "export const solution = 'concurrency_proof';",
        technicalExplanation: "Finalized by Instance A",
        finalizedBy: "api_instance_A",
      }),
      instanceB.submitAssessment(sessionId, {
        finalCode: "export const solution = 'concurrency_proof';",
        technicalExplanation: "Finalized by Instance B",
        finalizedBy: "api_instance_B",
      }),
    ]);

    // Both instances must receive the exact same logical artifact and canonical SHA-256 fingerprint
    expect(resultA.id).toBe(resultB.id);
    expect(resultA.submissionFingerprint).toBe(resultB.submissionFingerprint);
    expect(resultA.submissionFingerprint).toMatch(/^[a-f0-9]{64}$/);

    // Database must hold EXACTLY ONE submission artifact record for this session
    const artifactsInDb = await submissionRepo.findBySessionId(sessionId);
    expect(artifactsInDb).toBeDefined();
    expect(artifactsInDb?.id).toBe(resultA.id);

    // Session state must be SUBMITTED
    const dbSession = await sessionRepo.findById(sessionId);
    expect(dbSession?.status).toBe(SessionState.SUBMITTED);
  });

  // --------------------------------------------------------------------------
  // 2. Candidate submission racing server expiry
  // --------------------------------------------------------------------------
  it("Test 2: handles candidate submission racing server background expiry processor", async () => {
    const { sessionId } = await createCandidateSession("cand_race@test.com", "Racer Candidate");

    const session = sessionService.getSession(sessionId);
    session.workspaceSnapshot.currentCode = "export function solveRacing() { return true; }";

    // Advance session past deadline
    session.expiresAt = new Date(Date.now() - 150000);
    session.gracePeriodSeconds = 30;

    // Race candidate submit with server background expiry sweep
    const [clientResult, sweepResult] = await Promise.all([
      submissionService.submitAssessment(sessionId, {
        finalCode: "export function solveRacing() { return true; }",
        technicalExplanation: "Submitted by candidate while server sweeper runs",
        finalizedBy: "candidate",
      }),
      expiryProcessor.sweep(),
    ]);

    expect(clientResult.id).toBeDefined();
    expect(clientResult.submissionFingerprint).toMatch(/^[a-f0-9]{64}$/);

    // Single artifact persisted
    const artifact = await submissionRepo.findBySessionId(sessionId);
    expect(artifact?.id).toBe(clientResult.id);
  });

  // --------------------------------------------------------------------------
  // 3. Duplicate submission requests (Idempotency)
  // --------------------------------------------------------------------------
  it("Test 3: handles rapid duplicate submission requests idempotently", async () => {
    const { sessionId } = await createCandidateSession("duplicate@test.com", "Multi Clicker");

    const payload = {
      finalCode: "export function handleMultiClicks() { return 'one_artifact'; }",
      technicalExplanation: "User clicked submit 5 times rapidly",
    };

    const requests = Array.from({ length: 5 }, () =>
      app.inject({ method: "POST", url: `/api/v1/sessions/${sessionId}/submit`, payload })
    );

    const responses = await Promise.all(requests);
    for (const res of responses) {
      expect(res.statusCode).toBe(200);
    }

    const bodies = responses.map((r) => r.json());
    const firstSubmissionId = bodies[0].submissionId;
    const firstFingerprint = bodies[0].submissionFingerprint;

    for (const b of bodies) {
      expect(b.submissionId).toBe(firstSubmissionId);
      expect(b.submissionFingerprint).toBe(firstFingerprint);
      expect(["SUBMITTED", "submitted"]).toContain(b.status);
    }
  });

  // --------------------------------------------------------------------------
  // 4. Process crash during FINALIZING & recovery after restart (Invariant 7)
  // --------------------------------------------------------------------------
  it("Test 4: automatically recovers and finalizes sessions stuck in FINALIZING after worker crash", async () => {
    const { sessionId } = await createCandidateSession("stuck@test.com", "Crash Recovery Candidate");

    // 1. Simulate session entered FINALIZING but node process crashed before saving artifact
    const pastFinalizingTime = new Date(Date.now() - 45000); // 45 seconds ago (exceeds 30s lease)
    await sessionRepo.atomicTransitionState(
      sessionId,
      [SessionState.ACTIVE],
      SessionState.FINALIZING,
      {
        finalizingAt: pastFinalizingTime,
        finalizingBy: "crashed_worker_node_1",
      }
    );

    const stuckSession = await sessionRepo.findById(sessionId);
    expect(stuckSession?.status).toBe(SessionState.FINALIZING);

    // 2. New API instance starts up and runs recovery sweep
    const sweepResult = await expiryProcessor.sweep();
    expect(sweepResult.recoveredCount).toBeGreaterThanOrEqual(1);
    expect(sweepResult.finalizedSessionIds).toContain(sessionId);

    // 3. Session successfully transitioned to terminal SUBMITTED
    const recoveredSession = await sessionRepo.findById(sessionId);
    expect(recoveredSession?.status).toBe(SessionState.SUBMITTED);

    // 4. Artifact created from last snapshot
    const artifact = await submissionRepo.findBySessionId(sessionId);
    expect(artifact).toBeDefined();
    expect(artifact?.technicalExplanation).toContain("prior finalization worker lease timed out");
  });

  // --------------------------------------------------------------------------
  // 5. Multiple expiry workers (Partition & Lease Safety)
  // --------------------------------------------------------------------------
  it("Test 5: multiple expiry workers do not duplicate finalization sweeps", async () => {
    const { sessionId } = await createCandidateSession("multi_worker@test.com", "Worker Candidate");

    const session = sessionService.getSession(sessionId);
    session.expiresAt = new Date(Date.now() - 200000);
    session.gracePeriodSeconds = 30;

    const worker1 = new SessionExpiryProcessor(sessionService, submissionService, undefined, undefined, { enabled: false }, sessionRepo, submissionRepo);
    const worker2 = new SessionExpiryProcessor(sessionService, submissionService, undefined, undefined, { enabled: false }, sessionRepo, submissionRepo);

    const [res1, res2] = await Promise.all([worker1.sweep(), worker2.sweep()]);

    const totalFinalized = res1.finalizedCount + res2.finalizedCount;
    expect(totalFinalized).toBe(1);

    const dbSession = await sessionRepo.findById(sessionId);
    expect(dbSession?.status).toBe(SessionState.SUBMITTED);
  });

  // --------------------------------------------------------------------------
  // 6. Pause / Resume racing deadline expiration
  // --------------------------------------------------------------------------
  it("Test 6: proctor pause prevents expiry sweep, and resume safely extends deadline", async () => {
    const { sessionId } = await createCandidateSession("pause_race@test.com", "Pause Race Candidate");

    // Pause session
    sessionService.pauseSession(sessionId, "Hardware incident during interview", "proctor_lead");
    const paused = sessionService.getSession(sessionId);
    expect(paused.status).toBe(SessionState.PAUSED);

    // Expiry sweep runs while paused: must SKIP paused session
    const sweepResult = await expiryProcessor.sweep();
    expect(sweepResult.finalizedSessionIds).not.toContain(sessionId);

    // Proctor resumes session after 60ms delay
    await new Promise((r) => setTimeout(r, 60));
    const resumed = sessionService.resumeSession(sessionId, "proctor_lead");
    expect(resumed.status).toBe(SessionState.ACTIVE);
    expect(resumed.totalPausedMs).toBeGreaterThanOrEqual(40);

    // Editing allowed again
    const updated = sessionService.updateWorkspaceCode(sessionId, {
      code: "export const recoveredAfterPause = true;",
    });
    expect(updated.workspaceSnapshot.currentCode).toBe("export const recoveredAfterPause = true;");
  });

  // --------------------------------------------------------------------------
  // 7. Grace period strictly locks candidate edits & ignores unpersisted code
  // --------------------------------------------------------------------------
  it("Test 7: strictly rejects candidate code edits during grace period and seals last snapshot", async () => {
    const { sessionId } = await createCandidateSession("grace_strict@test.com", "Grace Candidate");

    // Candidate saves valid work before deadline
    const acknowledgedSnapshot = "export function legitWork() { return 'saved_before_deadline'; }";
    await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      payload: { code: acknowledgedSnapshot },
    });

    // Advance session past duration (soft expiry -> GRACE_PERIOD)
    const session = sessionService.getSession(sessionId);
    session.expiresAt = new Date(Date.now() - 5000);
    session.gracePeriodSeconds = 60;

    // 1. Candidate attempts to edit code during grace period -> REJECTED (410)
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      payload: { code: "export const lateCheatingCode = true;" },
    });
    expect(patchRes.statusCode).toBe(410);

    // 2. Candidate attempts to submit with injected late code -> server authoritative rule seals ONLY the previously saved snapshot
    const submitRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/submit`,
      payload: {
        finalCode: "export const injectedLateCode = true;",
        technicalExplanation: "Attempted to submit modified code during grace window",
      },
    });
    expect(submitRes.statusCode).toBe(200);

    const artifact = await submissionRepo.findBySessionId(sessionId);
    expect(artifact?.finalCode).toBe(acknowledgedSnapshot);
    expect(artifact?.finalCode).not.toContain("injectedLateCode");
  });

  // --------------------------------------------------------------------------
  // 8. Multi-task Evidence Snapshot Preservation (Phase 3)
  // --------------------------------------------------------------------------
  it("Test 8: preserves full multi-task evidence bundle, revisions, and canonical SHA-256 fingerprint", async () => {
    const { sessionId } = await createCandidateSession("evidence@test.com", "Evidence Candidate");

    const session = sessionService.getSession(sessionId);
    expect(session.lastPersistedRevision).toBe(0);

    // Autosave updates incrementing revision counter
    sessionService.updateWorkspaceCode(sessionId, { code: "export class Mutex { locked = false; }" });
    expect(session.lastPersistedRevision).toBe(1);

    sessionService.updateWorkspaceCode(sessionId, { code: "export class Mutex { locked = false; acquire() { this.locked = true; } }" });
    expect(session.lastPersistedRevision).toBe(2);

    // Submit multi-task responses
    const taskSubmissions = {
      task_mcq: {
        taskId: "task_mcq",
        taskType: "question_set" as const,
        status: "completed" as const,
        answers: {
          q_cas: { selectedOptionIds: ["opt_cas_1"] },
        },
        earnedPoints: 30,
        maxPoints: 30,
      },
      task_code: {
        taskId: "task_code",
        taskType: "coding_challenge" as const,
        status: "completed" as const,
        codeSubmission: {
          code: session.workspaceSnapshot.currentCode,
          language: "typescript",
        },
        maxPoints: 70,
      },
    };

    const artifact = await submissionService.submitAssessment(sessionId, {
      finalCode: session.workspaceSnapshot.currentCode,
      technicalExplanation: "Completed atomic CAS questionnaire and reentrant mutex implementation.",
      taskSubmissions,
      multiFileChanges: {
        "src/mutex.ts": session.workspaceSnapshot.currentCode,
      },
      finalizedBy: "candidate",
    });

    // Evidence checks
    expect(artifact.serverAcknowledgedRevision).toBe(2);
    expect(artifact.finalizedBy).toBe("candidate");
    expect(artifact.multiFileChanges).toBeDefined();
    expect(artifact.taskSubmissions?.task_mcq?.earnedPoints).toBe(30);
    expect(artifact.submissionFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  // --------------------------------------------------------------------------
  // 9. Reconnect and refresh after terminal SUBMITTED state (Permanent Sealing)
  // --------------------------------------------------------------------------
  it("Test 9: candidate cannot re-enter or reopen session after terminal submission", async () => {
    const { sessionId, invitation } = await createCandidateSession("sealed@test.com", "Terminal Candidate");

    // Finalize session
    await submissionService.submitAssessment(sessionId, {
      finalCode: "export const done = true;",
      technicalExplanation: "Candidate finalized",
    });

    // 1. Attempt to re-accept the candidate invitation -> 409 INVITATION_INVALID
    const reAcceptRes = await app.inject({
      method: "POST",
      url: `/api/v1/invitations/accept/${invitation.invitationToken}`,
      payload: { agreedToIntegrityPolicy: true },
    });
    expect(reAcceptRes.statusCode).toBe(409);
    expect(reAcceptRes.json().message).toContain("completed and submitted");

    // 2. Candidate client heartbeat reflects terminal status
    const hbRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${sessionId}/heartbeat`,
    });
    expect(hbRes.statusCode).toBe(200);
    const hb = hbRes.json();
    expect(["SUBMITTED", "submitted"]).toContain(hb.status);
    expect(hb.remainingSeconds).toBe(0);
  });
});
