import crypto from "node:crypto";
import type {
  AssessmentSession,
  CreateSessionRequest,
  SessionHeartbeatResponse,
  UpdateWorkspaceRequest,
  SubmitSessionRequest,
} from "@ai-copilot/contracts";
import type { AssessmentTemplateService } from "./template.js";
import type { OrganizationService } from "./organization.js";
import type { AIUsageGatewayService } from "./gateway.js";

export class SessionNotFoundError extends Error {
  constructor(message = "Assessment session not found") {
    super(message);
    this.name = "SessionNotFoundError";
  }
}

export class SessionExpiredError extends Error {
  constructor(message = "Assessment session has expired. Modifications and AI calls are blocked.") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

export class SessionInvalidStateError extends Error {
  constructor(message = "Assessment session is not in a valid state for this operation") {
    super(message);
    this.name = "SessionInvalidStateError";
  }
}

export class AssessmentSessionService {
  // Key: sessionId -> AssessmentSession
  private sessions = new Map<string, AssessmentSession>();
  // Key: orgId -> Set<sessionId>
  private sessionsByOrg = new Map<string, Set<string>>();

  constructor(
    private templateService: AssessmentTemplateService,
    private orgService: OrganizationService,
    private gateway: AIUsageGatewayService
  ) {}

  public createSession(req: CreateSessionRequest): AssessmentSession {
    const org = this.orgService.getOrganizationById(req.organizationId);
    if (!org) {
      throw new Error(`Organization '${req.organizationId}' does not exist`);
    }

    const template = this.templateService.getTemplateById(req.organizationId, req.templateId);
    if (!template) {
      throw new Error(`Assessment template '${req.templateId}' does not exist in organization`);
    }

    const sessionId = "sess_" + crypto.randomBytes(8).toString("hex") + "_" + Date.now();
    const durationMinutes = req.durationMinutes ?? template.durationMinutes;
    const gracePeriodSeconds = 60; // 60 seconds grace period for network latency on final submit
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);
    const customBudget = req.customAiBudgetUsd ?? template.defaultAiBudgetUsd;

    const toolPolicy = {
      ...template.toolPolicy,
      maxBudgetUsd: customBudget,
      timeLimitSeconds: durationMinutes * 60,
    };

    const session: AssessmentSession = {
      id: sessionId,
      organizationId: req.organizationId,
      templateId: req.templateId,
      versionId: req.versionId,
      invitationId: req.invitationId,
      candidateEmail: req.candidateEmail.toLowerCase().trim(),
      candidateName: req.candidateName.trim(),
      status: "in_progress",
      startedAt,
      expiresAt,
      totalPausedMs: 0,
      durationMinutes,
      gracePeriodSeconds,
      allocatedAiBudgetUsd: customBudget,
      consumedAiBudgetUsd: 0,
      toolPolicy,
      workspaceSnapshot: {
        currentCode: template.starterCode,
        lastSavedAt: startedAt,
      },
      createdAt: startedAt,
      updatedAt: startedAt,
    };

    this.sessions.set(sessionId, session);

    let orgSet = this.sessionsByOrg.get(req.organizationId);
    if (!orgSet) {
      orgSet = new Set();
      this.sessionsByOrg.set(req.organizationId, orgSet);
    }
    orgSet.add(sessionId);

    // Initialize Gateway with strict budget and time boundaries
    this.gateway.initializeSession(sessionId, toolPolicy, startedAt);

    return session;
  }

  public getSession(sessionId: string): AssessmentSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(`Session '${sessionId}' not found`);
    }

    // Dynamic state transition based on server wall-clock
    this.checkAndUpdateExpiration(session);
    return session;
  }

  public heartbeat(sessionId: string): SessionHeartbeatResponse {
    const session = this.getSession(sessionId);
    const now = Date.now();
    const isPaused = session.status === "paused";

    let remainingSeconds = 0;
    if (isPaused && session.pausedAt) {
      // When paused, remainingSeconds is frozen at the exact moment of pause
      const pauseAtMs = new Date(session.pausedAt).getTime();
      const expiresAtMs = new Date(session.expiresAt).getTime();
      remainingSeconds = Math.max(0, Math.ceil((expiresAtMs - pauseAtMs) / 1000));
    } else {
      const expiresAtMs = new Date(session.expiresAt).getTime();
      remainingSeconds = Math.max(0, Math.ceil((expiresAtMs - now) / 1000));
    }

    const expiresAtMs = new Date(session.expiresAt).getTime();
    const gracePeriodMs = session.gracePeriodSeconds * 1000;
    const isExpired = !isPaused && remainingSeconds <= 0;
    const inGracePeriod = !isPaused && isExpired && now <= expiresAtMs + gracePeriodMs;

    const budgetStatus = this.gateway.getBudgetStatus(sessionId);
    session.consumedAiBudgetUsd = budgetStatus.consumedBudgetUsd;

    return {
      sessionId,
      status: session.status,
      remainingSeconds,
      isExpired,
      inGracePeriod,
      isPaused,
      pauseReason: session.pauseReason,
      consumedBudgetUsd: budgetStatus.consumedBudgetUsd,
      remainingBudgetUsd: budgetStatus.remainingBudgetUsd,
      budgetWarning: budgetStatus.isWarningTriggered,
    };
  }

  public assertCanCode(sessionId: string): AssessmentSession {
    const session = this.getSession(sessionId);

    if (session.status === "paused") {
      throw new SessionInvalidStateError("Workspace is temporarily locked: assessment session has been paused by the proctor");
    }

    if (session.status === "submitted") {
      throw new SessionInvalidStateError("Cannot modify workspace: candidate assessment is already submitted");
    }

    if (session.status === "terminated") {
      throw new SessionInvalidStateError("Cannot modify workspace: candidate session was terminated");
    }

    const now = Date.now();
    const hardDeadlineMs =
      new Date(session.expiresAt).getTime() + session.gracePeriodSeconds * 1000;

    if (now > hardDeadlineMs) {
      session.status = "expired";
      throw new SessionExpiredError("Assessment time limit has expired. Workspace modifications are locked.");
    }

    return session;
  }

  public assertCanInvokeAI(sessionId: string): AssessmentSession {
    const session = this.getSession(sessionId);

    if (session.status === "paused") {
      throw new SessionInvalidStateError("AI assistance is temporarily unavailable: session has been paused by the proctor");
    }

    if (session.status !== "in_progress") {
      throw new SessionInvalidStateError(`AI assistance unavailable: session status is '${session.status}'`);
    }

    const now = Date.now();
    if (now > new Date(session.expiresAt).getTime()) {
      session.status = "expired";
      throw new SessionExpiredError("Assessment session duration has elapsed. AI invocations are prohibited.");
    }

    return session;
  }

  public updateWorkspaceCode(
    sessionId: string,
    req: UpdateWorkspaceRequest
  ): AssessmentSession {
    const session = this.assertCanCode(sessionId);
    const now = new Date();

    session.workspaceSnapshot.currentCode = req.code;
    session.workspaceSnapshot.lastSavedAt = now;
    session.updatedAt = now;

    if (req.testResults) {
      session.workspaceSnapshot.lastTestTotalCount = req.testResults.length;
      session.workspaceSnapshot.lastTestPassedCount = req.testResults.filter((t) => t.passed).length;
    }

    return session;
  }

  public submitSession(
    sessionId: string,
    req: SubmitSessionRequest
  ): AssessmentSession {
    const session = this.getSession(sessionId);

    if (session.status === "submitted") {
      return session; // Idempotent submit
    }

    if (session.status === "terminated") {
      throw new SessionInvalidStateError("Terminated session cannot be submitted");
    }

    const now = Date.now();
    const hardDeadlineMs =
      new Date(session.expiresAt).getTime() + session.gracePeriodSeconds * 1000;

    if (now > hardDeadlineMs && session.status === "expired") {
      throw new SessionExpiredError("Submission deadline past grace period. Contact your interviewer for assistance.");
    }

    const submitDate = new Date();
    session.status = "submitted";
    session.submittedAt = submitDate;
    session.updatedAt = submitDate;
    session.workspaceSnapshot.currentCode = req.finalCode;
    session.workspaceSnapshot.lastSavedAt = submitDate;

    if (req.testResults) {
      session.workspaceSnapshot.lastTestTotalCount = req.testResults.length;
      session.workspaceSnapshot.lastTestPassedCount = req.testResults.filter((t) => t.passed).length;
    }

    return session;
  }

  public pauseSession(sessionId: string, reason?: string): AssessmentSession {
    const session = this.getSession(sessionId);

    if (session.status === "paused") {
      return session; // Idempotent
    }

    if (session.status !== "in_progress" && session.status !== "created") {
      throw new SessionInvalidStateError(`Cannot pause session with status '${session.status}'`);
    }

    const now = new Date();
    session.status = "paused";
    session.pausedAt = now;
    session.pauseReason = reason || "Proctor incident pause";
    session.updatedAt = now;

    return session;
  }

  public resumeSession(sessionId: string): AssessmentSession {
    const session = this.getSession(sessionId);

    if (session.status !== "paused") {
      throw new SessionInvalidStateError(`Cannot resume session that is not paused (current status: '${session.status}')`);
    }

    const now = Date.now();
    const pausedAtMs = session.pausedAt ? new Date(session.pausedAt).getTime() : now;
    const pauseDurationMs = Math.max(0, now - pausedAtMs);

    session.totalPausedMs = (session.totalPausedMs || 0) + pauseDurationMs;
    session.expiresAt = new Date(new Date(session.expiresAt).getTime() + pauseDurationMs);
    session.pausedAt = undefined;
    session.pauseReason = undefined;
    session.status = "in_progress";
    session.updatedAt = new Date();

    return session;
  }

  public terminateSession(sessionId: string, reason: string): AssessmentSession {
    const session = this.getSession(sessionId);
    session.status = "terminated";
    session.terminationReason = reason;
    session.updatedAt = new Date();
    return session;
  }

  public listSessionsForOrg(organizationId: string): AssessmentSession[] {
    const orgSet = this.sessionsByOrg.get(organizationId);
    if (!orgSet) return [];

    const list: AssessmentSession[] = [];
    for (const id of orgSet) {
      const sess = this.sessions.get(id);
      if (sess) {
        this.checkAndUpdateExpiration(sess);
        list.push(sess);
      }
    }

    return list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  private checkAndUpdateExpiration(session: AssessmentSession): void {
    if (session.status === "in_progress") {
      const now = Date.now();
      const hardDeadlineMs =
        new Date(session.expiresAt).getTime() + session.gracePeriodSeconds * 1000;
      if (now > hardDeadlineMs) {
        session.status = "expired";
      }
    }
  }
}

