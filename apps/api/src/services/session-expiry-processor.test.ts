import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";
import type { AssessmentSessionService } from "./session.js";
import type { SubmissionService } from "./submission.js";
import type { CandidateInvitationService } from "./invitation.js";
import type { SessionExpiryProcessor } from "./session-expiry-processor.js";
import type { SessionEventsService } from "./session-events.js";

const testConfig: AppConfig = {
  PORT: 4016,
  HOST: "127.0.0.1",
  NODE_ENV: "test",
  DEFAULT_AI_PROVIDER: "mock",
  JWT_SECRET: "test-secret-key-32-chars-minimum-safe-12345",
  EXPIRY_SWEEP_INTERVAL_MS: 100, // fast sweep for tests
};

describe("LOOP 10.0.3: Server-Authoritative Assessment Expiry & Finalization Reliability", () => {
  let app: FastifyInstance;
  let sessionService: AssessmentSessionService;
  let submissionService: SubmissionService;
  let invitationService: CandidateInvitationService;
  let expiryProcessor: SessionExpiryProcessor;
  let eventsService: SessionEventsService;

  let orgId: string;
  let templateId: string;
  let interviewerToken: string;

  beforeEach(async () => {
    app = await buildApp(testConfig);
    await app.ready();

    sessionService = (app as any).sessionService;
    submissionService = (app as any).submissionService;
    invitationService = (app as any).invitationService;
    expiryProcessor = (app as any).expiryProcessor;
    eventsService = (app as any).sessionService.eventsService;

    // Retrieve default organization & template
    const orgRes = await app.inject({ method: "GET", url: "/api/v1/organizations" });
    const { organizations } = JSON.parse(orgRes.body);
    orgId = organizations[0].id;

    const tmplRes = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgId}`,
    });
    const { templates } = JSON.parse(tmplRes.body);
    templateId = templates[0].id;

    // Login as interviewer to create invitations
    const authRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: orgId, email: "priya@acme.corp" },
    });
    interviewerToken = JSON.parse(authRes.body).token;
  });

  afterEach(async () => {
    expiryProcessor?.stop();
    await app.close();
  });

  // Helper to create an active candidate session
  async function createCandidateSession(candidateName = "Candidate User", candidateEmail = "candidate@example.com") {
    const invRes = await app.inject({
      method: "POST",
      url: "/api/v1/invitations",
      headers: { Authorization: `Bearer ${interviewerToken}` },
      payload: {
        organizationId: orgId,
        templateId,
        candidateName,
        candidateEmail,
        expiresInDays: 7,
      },
    });
    const invitation = JSON.parse(invRes.body);

    const acceptRes = await app.inject({
      method: "POST",
      url: `/api/v1/invitations/accept/${invitation.invitationToken}`,
      payload: { agreedToIntegrityPolicy: true },
    });
    const sessionBootstrap = JSON.parse(acceptRes.body);

    return {
      invitation,
      sessionBootstrap,
      sessionId: sessionBootstrap.sessionId as string,
    };
  }

  // Criterion 1: Server-side expiry processor
  it("Criterion 1: runs server-side expiry processor sweep across all active sessions", async () => {
    const { sessionId } = await createCandidateSession("C1 Candidate", "c1@test.com");

    const sweepResult = await expiryProcessor.sweep();
    expect(sweepResult.sweptCount).toBeGreaterThanOrEqual(1);
    expect(sweepResult.durationMs).toBeGreaterThanOrEqual(0);

    const session = sessionService.getSession(sessionId);
    expect(session.status).toBe("in_progress");
  });

  // Criterion 2: Automatic finalization from the last persisted snapshot
  it("Criterion 2: automatically finalizes session from last persisted snapshot when candidate disappears", async () => {
    const { sessionId, invitation } = await createCandidateSession("Offline Candidate", "offline@test.com");

    // Candidate made progress and saved a snapshot, then disconnected/closed browser
    const snapshotCode = "export function solveSupportQueue() { return 'saved progress'; }";
    await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      payload: { code: snapshotCode },
    });

    // Advance session past duration and grace period (hard deadline reached)
    const session = sessionService.getSession(sessionId);
    const pastTime = new Date(Date.now() - 120000); // 2 minutes in past
    session.expiresAt = pastTime;
    session.gracePeriodSeconds = 30; // 30 second grace period, so 2 mins ago is expired

    // Server-side expiry processor sweep runs
    const result = await expiryProcessor.sweep();
    expect(result.finalizedCount).toBe(1);
    expect(result.finalizedSessionIds).toContain(sessionId);

    // Session must now be submitted
    const updatedSession = sessionService.getSession(sessionId);
    expect(updatedSession.status).toBe("submitted");
    expect(updatedSession.submittedAt).toBeDefined();

    // Submission artifact was created from the snapshot
    const artifact = submissionService.getSubmission(sessionId);
    expect(artifact).toBeDefined();
    expect(artifact.finalCode).toBe(snapshotCode);
    expect(artifact.submissionFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(artifact.technicalExplanation).toContain("Auto-finalized by server");

    // Associated invitation is completed
    const updatedInv = invitationService.getInvitationBySessionId(sessionId);
    expect(updatedInv).toBeDefined();
    expect(updatedInv?.status).toBe("completed");
  });

  // Criterion 3: No post-deadline candidate edits
  it("Criterion 3: strictly rejects candidate code edits after session duration expires (HTTP 410)", async () => {
    const { sessionId } = await createCandidateSession("Late Candidate", "late@test.com");

    // Set expiry in the past
    const session = sessionService.getSession(sessionId);
    session.expiresAt = new Date(Date.now() - 5000); // 5 seconds expired

    // Candidate attempts to edit workspace code after deadline
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      payload: { code: "export const maliciousLateCode = true;" },
    });

    expect(patchRes.statusCode).toBe(410);
    const body = JSON.parse(patchRes.body);
    expect(body.error).toBe("SESSION_EXPIRED");
    expect(body.message).toContain("Assessment duration has elapsed");
  });

  // Criterion 4 & 9: Atomic, idempotent submission & simultaneous client/server submission
  it("Criterion 4 & 9: handles simultaneous client and server submission atomically without duplicate records", async () => {
    const { sessionId } = await createCandidateSession("Racer Candidate", "racer@test.com");

    const candidateFinalCode = "export function solve() { return 'candidate submission'; }";
    await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      payload: { code: candidateFinalCode },
    });

    // Simulate both candidate clicking submit AND server-side autoFinalizeSession running simultaneously
    const [clientResult, serverResult] = await Promise.all([
      submissionService.submitAssessment(sessionId, {
        finalCode: candidateFinalCode,
        technicalExplanation: "Candidate submitted at the buzzer.",
      }),
      submissionService.autoFinalizeSession(
        sessionId,
        "Auto-finalized by server watchdog"
      ),
    ]);

    // Both must return the EXACT same immutable artifact and fingerprint
    expect(clientResult.id).toBe(serverResult.id);
    expect(clientResult.submissionFingerprint).toBe(serverResult.submissionFingerprint);
    expect(clientResult.finalCode).toBe(serverResult.finalCode);

    // Verify session status is submitted
    const session = sessionService.getSession(sessionId);
    expect(session.status).toBe("submitted");

    // Verify only ONE artifact exists in submission service
    const storedArtifact = submissionService.getSubmission(sessionId);
    expect(storedArtifact.id).toBe(clientResult.id);
  });

  // Criterion 9: Duplicate rapid submission requests return identical 200 responses
  it("Criterion 9: handles rapid duplicate HTTP submit requests idempotently", async () => {
    const { sessionId } = await createCandidateSession("Rapid Clicker", "rapid@test.com");

    const payload = {
      finalCode: "export function handleTriage() { return 42; }",
      technicalExplanation: "User clicked submit multiple times quickly.",
    };

    // Fire 5 concurrent submit requests
    const responses = await Promise.all([
      app.inject({ method: "POST", url: `/api/v1/sessions/${sessionId}/submit`, payload }),
      app.inject({ method: "POST", url: `/api/v1/sessions/${sessionId}/submit`, payload }),
      app.inject({ method: "POST", url: `/api/v1/sessions/${sessionId}/submit`, payload }),
      app.inject({ method: "POST", url: `/api/v1/sessions/${sessionId}/submit`, payload }),
      app.inject({ method: "POST", url: `/api/v1/sessions/${sessionId}/submit`, payload }),
    ]);

    // All must succeed with 200 OK
    for (const res of responses) {
      expect(res.statusCode).toBe(200);
    }

    const bodies = responses.map((r) => JSON.parse(r.body));
    const firstSubmissionId = bodies[0].submissionId;
    const firstFingerprint = bodies[0].submissionFingerprint;

    // All 5 responses must return identical submission ID and fingerprint
    for (const b of bodies) {
      expect(b.submissionId).toBe(firstSubmissionId);
      expect(b.submissionFingerprint).toBe(firstFingerprint);
      expect(b.status).toBe("submitted");
    }
  });

  // Criterion 5: Timer reconciliation using server time
  it("Criterion 5: reconciles client timer using server-authoritative heartbeat and timestamp", async () => {
    const { sessionId } = await createCandidateSession("Timer Candidate", "timer@test.com");

    const hbRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${sessionId}/heartbeat`,
    });
    expect(hbRes.statusCode).toBe(200);
    const hb = JSON.parse(hbRes.body);

    expect(hb.sessionId).toBe(sessionId);
    expect(hb.remainingSeconds).toBeGreaterThan(0);
    expect(hb.serverTimestamp).toBeDefined();
    expect(new Date(hb.serverTimestamp).getTime()).toBeGreaterThan(0);
    expect(hb.isExpired).toBe(false);
    expect(hb.inGracePeriod).toBe(false);
  });

  // Criterion 6: Recovery after API restart
  it("Criterion 6: recovers expired sessions and finalizes them on startup sweep after API restart", async () => {
    const { sessionId } = await createCandidateSession("Reboot Candidate", "reboot@test.com");

    // Candidate had saved code
    await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      payload: { code: "export function rebootProof() { return true; }" },
    });

    // Simulate API crashed while candidate session expired
    const session = sessionService.getSession(sessionId);
    session.expiresAt = new Date(Date.now() - 300000); // 5 minutes ago
    session.gracePeriodSeconds = 60;

    // Simulate API server boot recovery sweep
    const startupSweepResult = await expiryProcessor.sweep();
    expect(startupSweepResult.finalizedSessionIds).toContain(sessionId);

    // Session is now finalized
    const updated = sessionService.getSession(sessionId);
    expect(updated.status).toBe("submitted");
  });

  // Criterion 7: Correct handling of offline candidates and network grace periods
  it("Criterion 7: honors network grace period before triggering server auto-finalization", async () => {
    const { sessionId } = await createCandidateSession("Grace Candidate", "grace@test.com");

    const session = sessionService.getSession(sessionId);
    session.gracePeriodSeconds = 60;
    // Set expiresAt to 10 seconds ago (soft deadline passed, but within 60s grace period)
    session.expiresAt = new Date(Date.now() - 10000);

    // Heartbeat during grace period
    const hbRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${sessionId}/heartbeat`,
    });
    const hb = JSON.parse(hbRes.body);
    expect(hb.isExpired).toBe(true);
    expect(hb.inGracePeriod).toBe(true);

    // Expiry sweep during grace period must NOT finalize yet
    const sweepDuringGrace = await expiryProcessor.sweep();
    expect(sweepDuringGrace.finalizedSessionIds).not.toContain(sessionId);
    expect(sessionService.getSession(sessionId).status).toBe("in_progress");

    // Candidate can still submit during grace period
    const submitRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/submit`,
      payload: {
        finalCode: "export function solvedInGracePeriod() { return true; }",
        technicalExplanation: "Submitted during network grace window.",
      },
    });
    expect(submitRes.statusCode).toBe(200);
    expect(sessionService.getSession(sessionId).status).toBe("submitted");
  });

  // Criterion 8: Candidate sees the same completed status after reopening their invitation
  it("Criterion 8: candidate sees completed status and cannot re-enter after server auto-finalizes", async () => {
    const { sessionId, invitation } = await createCandidateSession("Reopening Candidate", "reopen@test.com");

    // Set hard expired and run sweep
    const session = sessionService.getSession(sessionId);
    session.expiresAt = new Date(Date.now() - 120000);
    session.gracePeriodSeconds = 30;
    await expiryProcessor.sweep();

    // 1. Verify invitation API returns status: "completed"
    const verifyRes = await app.inject({
      method: "GET",
      url: `/api/v1/invitations/verify/${invitation.invitationToken}`,
    });
    expect(verifyRes.statusCode).toBe(200);
    const verifyData = JSON.parse(verifyRes.body);
    expect(verifyData.invitation.status).toBe("completed");

    // 2. Candidate attempts to re-accept/re-enter session: rejected with HTTP 409
    const acceptRes = await app.inject({
      method: "POST",
      url: `/api/v1/invitations/accept/${invitation.invitationToken}`,
      payload: { agreedToIntegrityPolicy: true },
    });
    expect(acceptRes.statusCode).toBe(409);
    const acceptBody = JSON.parse(acceptRes.body);
    expect(acceptBody.error).toBe("INVITATION_INVALID");
    expect(acceptBody.message).toContain("completed and submitted");
  });

  // Criterion 10: Browser-level end-to-end scenarios (refresh, browser closure, disconnection, timeout)
  describe("Criterion 10: End-to-end lifecycle and browser event simulations", () => {
    it("Scenario A: Candidate refreshes browser tab halfway through attempt", async () => {
      const { sessionId, invitation } = await createCandidateSession("Refresher", "refresh@test.com");

      // Autosaved mid-way progress
      const codeMidway = "export function midwayWork() { return 100; }";
      await app.inject({
        method: "PATCH",
        url: `/api/v1/sessions/${sessionId}/workspace`,
        payload: { code: codeMidway },
      });

      // Browser refreshes (candidate calls accept again with invitation token)
      const reloadRes = await app.inject({
        method: "POST",
        url: `/api/v1/invitations/accept/${invitation.invitationToken}`,
        payload: { agreedToIntegrityPolicy: true },
      });
      expect(reloadRes.statusCode).toBe(200);
      const reloadData = JSON.parse(reloadRes.body);

      // Session ID and clock are preserved, not restarted
      expect(reloadData.sessionId).toBe(sessionId);
      expect(reloadData.isSubmitted).toBe(false);

      // Session state restores candidate code
      const getSessionRes = await app.inject({
        method: "GET",
        url: `/api/v1/sessions/${sessionId}`,
      });
      const sessionData = JSON.parse(getSessionRes.body);
      expect(sessionData.workspaceSnapshot.currentCode).toBe(codeMidway);
    });

    it("Scenario B: Candidate browser abruptly closes and never returns", async () => {
      const { sessionId, invitation } = await createCandidateSession("Disappearing", "disappear@test.com");

      // Candidate worked for 10 minutes and had an autosave
      const lastSavedCode = "export function beforeLaptopDied() { return 'saved in db'; }";
      await app.inject({
        method: "PATCH",
        url: `/api/v1/sessions/${sessionId}/workspace`,
        payload: { code: lastSavedCode },
      });

      // Candidate's laptop battery dies, browser disappears completely.
      // Clock ticks until hard deadline passes
      const session = sessionService.getSession(sessionId);
      session.expiresAt = new Date(Date.now() - 100000);
      session.gracePeriodSeconds = 30;

      // Server background processor automatically sweeps and finalizes
      const sweep = await expiryProcessor.sweep();
      expect(sweep.finalizedSessionIds).toContain(sessionId);

      // Status is sealed in DB
      const finalized = sessionService.getSession(sessionId);
      expect(finalized.status).toBe("submitted");

      // Submission contains candidate's last saved code
      const artifact = submissionService.getSubmission(sessionId);
      expect(artifact.finalCode).toBe(lastSavedCode);

      // When candidate opens invitation later, they see completed
      const checkInv = await app.inject({
        method: "GET",
        url: `/api/v1/invitations/verify/${invitation.invitationToken}`,
      });
      expect(JSON.parse(checkInv.body).invitation.status).toBe("completed");
    });

    it("Scenario C: Disconnection at deadline followed by reconnection attempts", async () => {
      const { sessionId } = await createCandidateSession("Disconnected", "disc@test.com");

      // Hard expire
      const session = sessionService.getSession(sessionId);
      session.expiresAt = new Date(Date.now() - 120000);
      session.gracePeriodSeconds = 30;
      await expiryProcessor.sweep();

      // Candidate reconnects and tries to send edits: rejected with 409 INVALID_STATE or 410 SESSION_EXPIRED
      const postExpiryPatch = await app.inject({
        method: "PATCH",
        url: `/api/v1/sessions/${sessionId}/workspace`,
        payload: { code: "new code" },
      });
      expect(postExpiryPatch.statusCode).toBe(409); // session is already submitted

      // Candidate client heartbeat detects status: "submitted"
      const hbRes = await app.inject({
        method: "GET",
        url: `/api/v1/sessions/${sessionId}/heartbeat`,
      });
      const hb = JSON.parse(hbRes.body);
      expect(hb.status).toBe("submitted");
      expect(hb.remainingSeconds).toBe(0);
    });
  });
});

