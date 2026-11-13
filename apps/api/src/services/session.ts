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
import type { SessionEventsService } from "./session-events.js";
import { SessionRepository } from "../repositories/session.repo.js";

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
  private repo: SessionRepository;
  private eventsService?: SessionEventsService;

  constructor(
    private templateService: AssessmentTemplateService,
    private orgService: OrganizationService,
    private gateway: AIUsageGatewayService,
    eventsService?: SessionEventsService,
    repo?: SessionRepository
  ) {
    this.eventsService = eventsService;
    this.repo = repo ?? new SessionRepository();
  }

  public setEventsService(eventsService: SessionEventsService): void {
    this.eventsService = eventsService;
  }

  public async loadFromDatabase(orgId?: string): Promise<void> {
    try {
      const list = orgId ? await this.repo.listByOrg(orgId) : await this.repo.listAll();
      for (const s of list) {
        this.sessions.set(s.id, s);
        let orgSet = this.sessionsByOrg.get(s.organizationId);
        if (!orgSet) {
          orgSet = new Set();
          this.sessionsByOrg.set(s.organizationId, orgSet);
        }
        orgSet.add(s.id);
        this.gateway.initializeSession(s.id, s.toolPolicy, s.startedAt);
      }
    } catch (err) {
      console.error("[AssessmentSessionService] Failed to load from database:", err);
    }
  }

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

    // Durable write-through to PostgreSQL
    this.repo.create(session).catch((err) => {
      console.error("[AssessmentSessionService] DB session create error:", err);
    });

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
    const isSubmitted = session.status === "submitted";

    let remainingSeconds = 0;
    if (isSubmitted) {
      remainingSeconds = 0;
    } else if (isPaused && session.pausedAt) {
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
    const isExpired = !isPaused && !isSubmitted && remainingSeconds <= 0;
    const inGracePeriod = !isPaused && !isSubmitted && isExpired && now <= expiresAtMs + gracePeriodMs;

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
      serverTimestamp: new Date(now).toISOString(),
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
    const expiresAtMs = new Date(session.expiresAt).getTime();

    if (now > expiresAtMs) {
      session.status = "expired";
      throw new SessionExpiredError("Assessment duration has elapsed. Workspace modifications are locked.");
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

    // Durable write-through to PostgreSQL
    this.repo.updateWorkspaceSnapshot(sessionId, session.workspaceSnapshot).catch((err) => {
      console.error("[AssessmentSessionService] DB snapshot update error:", err);
    });

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
    const isPastDeadline = now > hardDeadlineMs || session.status === "expired";

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

    // Durable write-through to PostgreSQL
    this.repo
      .update(sessionId, {
        status: "submitted",
        submittedAt: submitDate,
        workspaceSnapshot: session.workspaceSnapshot,
      })
      .catch((err) => {
        console.error("[AssessmentSessionService] DB submit update error:", err);
      });

    return session;
  }

  public pauseSession(sessionId: string, reason?: string, initiatedBy?: string): AssessmentSession {
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

    // Durable write-through to PostgreSQL
    this.repo.update(sessionId, {
      status: "paused",
      pausedAt: now,
      pauseReason: session.pauseReason,
    }).catch((err) => {
      console.error("[AssessmentSessionService] DB pause update error:", err);
    });

    // Record server-authoritative audit trail event
    this.eventsService?.recordEventDirect(sessionId, "session_paused", {
      reason: session.pauseReason,
      pausedAt: now.toISOString(),
      initiatedBy: initiatedBy || "proctor",
    });

    return session;
  }

  public resumeSession(sessionId: string, initiatedBy?: string): AssessmentSession {
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

    // Durable write-through to PostgreSQL
    this.repo.update(sessionId, {
      status: "in_progress",
      totalPausedMs: session.totalPausedMs,
      expiresAt: session.expiresAt,
    }).catch((err) => {
      console.error("[AssessmentSessionService] DB resume update error:", err);
    });

    // Record server-authoritative audit trail event
    this.eventsService?.recordEventDirect(sessionId, "session_resumed", {
      resumedAt: new Date(now).toISOString(),
      pauseDurationMs,
      totalPausedMs: session.totalPausedMs,
      newExpiresAt: session.expiresAt.toISOString(),
      initiatedBy: initiatedBy || "proctor",
    });

    return session;
  }

  public terminateSession(sessionId: string, reason: string): AssessmentSession {
    const session = this.getSession(sessionId);
    session.status = "terminated";
    session.terminationReason = reason;
    session.updatedAt = new Date();

    // Durable write-through to PostgreSQL
    this.repo.update(sessionId, {
      status: "terminated",
      terminationReason: reason,
    }).catch((err) => {
      console.error("[AssessmentSessionService] DB terminate update error:", err);
    });

    return session;
  }

  public async deleteSessionData(sessionId: string): Promise<{
    success: boolean;
    sessionId: string;
    deletedAt: string;
    recordsDeleted: {
      session: boolean;
      submissionArtifacts: boolean;
      sessionEvents: boolean;
      proctorIncidents: boolean;
    };
    retentionDisclaimer: {
      activeDatabase: string;
      disasterRecoveryBackups: string;
      externalAiProviders: string;
    };
  }> {
    const session = this.getSession(sessionId);

    // Remove from in-memory index
    this.sessions.delete(sessionId);
    const orgSet = this.sessionsByOrg.get(session.organizationId);
    if (orgSet) {
      orgSet.delete(sessionId);
    }
    this.eventsService?.clearSession(sessionId);

    // Hard-delete in database (cascades to session_events, submission_artifacts, proctor_incidents)
    await this.repo.delete(sessionId);

    return {
      success: true,
      sessionId,
      deletedAt: new Date().toISOString(),
      recordsDeleted: {
        session: true,
        submissionArtifacts: true,
        sessionEvents: true,
        proctorIncidents: true,
      },
      retentionDisclaimer: {
        activeDatabase: "Hard-deleted immediately from primary persistence engine",
        disasterRecoveryBackups:
          "Historical database snapshots retained in encrypted backup vault until automated 30-day rotation purge",
        externalAiProviders:
          "Prompts processed by external LLM inference providers (Groq, OpenAI, Anthropic, Google) are subject to third-party enterprise zero-data-retention or 30-day safety retention policies and cannot be purged on-demand via local API",
      },
    };
  }

  public listAllActiveSessions(): AssessmentSession[] {
    const list: AssessmentSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.status === "in_progress" || session.status === "created" || session.status === "paused") {
        list.push(session);
      }
    }
    return list;
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

