import crypto from "node:crypto";
import {
  type AssessmentSession,
  type CreateSessionRequest,
  type SessionHeartbeatResponse,
  type UpdateWorkspaceRequest,
  type SubmitSessionRequest,
  SessionState,
  normalizeSessionState,
  transitionSessionState,
  InvalidStateTransitionError,
  SessionLockedError,
} from "@ai-copilot/contracts";
import type { AssessmentTemplateService } from "./template.js";
import type { OrganizationService } from "./organization.js";
import type { AIUsageGatewayService } from "./gateway.js";
import type { SessionEventsService } from "./session-events.js";
import { SessionRepository } from "../repositories/session.repo.js";

export { SessionLockedError, InvalidStateTransitionError };

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

export class SessionStaleRevisionError extends Error {
  constructor(message = "Stale workspace revision rejected: incoming revision is older than currently persisted revision") {
    super(message);
    this.name = "SessionStaleRevisionError";
  }
}

export class MutationIdConflictError extends Error {
  constructor(message = "Mutation ID was already committed with different content") {
    super(message);
    this.name = "MutationIdConflictError";
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

  public getRepo(): SessionRepository {
    return this.repo;
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
      status: SessionState.ACTIVE,
      stateVersion: 1,
      lastPersistedRevision: 0,
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
        revision: 0,
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
    const isPaused = session.status === SessionState.PAUSED;
    const isSubmitted = session.status === SessionState.SUBMITTED;
    const isTerminated = session.status === SessionState.TERMINATED;

    let remainingSeconds = 0;
    if (isSubmitted || isTerminated) {
      remainingSeconds = 0;
    } else if (isPaused && session.pausedAt) {
      // When paused, remainingSeconds is frozen at the exact moment of pause
      const pauseAtMs = new Date(session.pausedAt).getTime();
      const expiresAtMs = new Date(session.expiresAt).getTime();
      remainingSeconds = Math.max(0, Math.ceil((expiresAtMs - pauseAtMs) / 1000));
    } else if (session.status === SessionState.GRACE_PERIOD || session.status === SessionState.FINALIZING) {
      remainingSeconds = 0;
    } else {
      const expiresAtMs = new Date(session.expiresAt).getTime();
      remainingSeconds = Math.max(0, Math.ceil((expiresAtMs - now) / 1000));
    }

    const expiresAtMs = new Date(session.expiresAt).getTime();
    const isExpired =
      !isPaused &&
      !isSubmitted &&
      (session.status === SessionState.GRACE_PERIOD ||
        session.status === SessionState.FINALIZING ||
        remainingSeconds <= 0);
    const inGracePeriod = !isPaused && !isSubmitted && session.status === SessionState.GRACE_PERIOD;

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

    if (session.status === SessionState.PAUSED) {
      throw new SessionInvalidStateError("Workspace is temporarily locked: assessment session has been paused by the proctor");
    }

    if (session.status === SessionState.SUBMITTED) {
      throw new SessionInvalidStateError("Cannot modify workspace: candidate assessment is already submitted");
    }

    if (session.status === SessionState.TERMINATED) {
      throw new SessionInvalidStateError("Cannot modify workspace: candidate session was terminated");
    }

    if (session.status === SessionState.FINALIZING) {
      throw new SessionInvalidStateError("Workspace is locked: assessment finalization is currently in progress.");
    }

    if (session.status === SessionState.GRACE_PERIOD) {
      throw new SessionExpiredError("Assessment duration has elapsed. Workspace modifications are locked during grace period.");
    }

    if (session.status !== SessionState.ACTIVE) {
      throw new SessionInvalidStateError(`Cannot modify workspace: session status is '${session.status}'`);
    }

    const now = Date.now();
    const expiresAtMs = new Date(session.expiresAt).getTime();

    if (now > expiresAtMs) {
      session.status = SessionState.GRACE_PERIOD;
      session.stateVersion = (session.stateVersion || 1) + 1;
      this.repo.atomicTransitionState(session.id, [SessionState.ACTIVE], SessionState.GRACE_PERIOD).catch(() => {});
      throw new SessionExpiredError("Assessment duration has elapsed. Workspace modifications are locked.");
    }

    return session;
  }

  public assertCanInvokeAI(sessionId: string): AssessmentSession {
    const session = this.getSession(sessionId);

    if (session.status === SessionState.PAUSED) {
      throw new SessionInvalidStateError("AI assistance is temporarily unavailable: session has been paused by the proctor");
    }

    if (session.status === SessionState.GRACE_PERIOD) {
      throw new SessionExpiredError("Assessment editing deadline has elapsed. AI invocations are prohibited during grace period.");
    }

    if (session.status === SessionState.FINALIZING) {
      throw new SessionInvalidStateError("AI assistance unavailable: session is finalizing");
    }

    if (session.status !== SessionState.ACTIVE) {
      throw new SessionInvalidStateError(`AI assistance unavailable: session status is '${session.status}'`);
    }

    const now = Date.now();
    if (now > new Date(session.expiresAt).getTime()) {
      session.status = SessionState.GRACE_PERIOD;
      session.stateVersion = (session.stateVersion || 1) + 1;
      this.repo.atomicTransitionState(session.id, [SessionState.ACTIVE], SessionState.GRACE_PERIOD).catch(() => {});
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

    session.lastPersistedRevision = (session.lastPersistedRevision ?? 0) + 1;
    session.workspaceSnapshot.currentCode = req.code;
    session.workspaceSnapshot.lastSavedAt = now;
    session.workspaceSnapshot.revision = session.lastPersistedRevision;
    session.updatedAt = now;

    if (req.testResults) {
      session.workspaceSnapshot.lastTestTotalCount = req.testResults.length;
      session.workspaceSnapshot.lastTestPassedCount = req.testResults.filter((t) => t.passed).length;
    }

    // Durable write-through to PostgreSQL with atomic revision increment
    this.repo.updateWorkspaceSnapshot(sessionId, session.workspaceSnapshot).catch((err) => {
      console.error("[AssessmentSessionService] DB snapshot update error:", err);
    });

    return session;
  }

  public async updateWorkspaceCodeAsync(
    sessionId: string,
    req: UpdateWorkspaceRequest
  ): Promise<AssessmentSession> {
    const session = this.assertCanCode(sessionId);
    const now = new Date();

    // 1. Fetch current database state to verify pre-conditions
    const dbSession = await this.repo.findById(sessionId);
    if (!dbSession) {
      throw new SessionNotFoundError(`Assessment session ${sessionId} not found`);
    }

    // 2. Check for mutation ID reuse before attempting any update
    if (req.clientMutationId) {
      const recent = dbSession.workspaceSnapshot?.recentMutations;
      const existingMutation = recent?.[req.clientMutationId];
      if (existingMutation) {
        if (existingMutation.code === req.code) {
          // Requirement 4: Identical retry returns the original committed result
          session.lastPersistedRevision = existingMutation.revision;
          session.workspaceSnapshot = {
            ...dbSession.workspaceSnapshot,
            currentCode: existingMutation.code,
            lastSavedAt: new Date(existingMutation.lastSavedAt),
            revision: existingMutation.revision,
            clientMutationId: req.clientMutationId,
          };
          session.updatedAt = dbSession.updatedAt;
          return session;
        } else {
          // Requirement 5: Reusing a mutation ID with different content returns HTTP 409
          throw new MutationIdConflictError(
            `Mutation ID '${req.clientMutationId}' was already committed with different content`
          );
        }
      }
    }

    // 3. Idempotent recovery for retried requests where clientMutationId was omitted
    if (
      dbSession.workspaceSnapshot?.currentCode === req.code &&
      ((req.baseRevision !== undefined && dbSession.lastPersistedRevision === req.baseRevision + 1) ||
       (req.clientRevision !== undefined && dbSession.lastPersistedRevision === req.clientRevision))
    ) {
      session.lastPersistedRevision = dbSession.lastPersistedRevision;
      session.workspaceSnapshot = dbSession.workspaceSnapshot;
      session.updatedAt = dbSession.updatedAt;
      return session;
    }

    // 4. Stale base revision check
    if (req.baseRevision !== undefined && dbSession.lastPersistedRevision !== req.baseRevision) {
      throw new SessionStaleRevisionError(
        `Stale workspace revision rejected: incoming base revision (${req.baseRevision}) does not match currently persisted revision (${dbSession.lastPersistedRevision})`
      );
    }

    // 4. Server revision increments exactly by one
    const newRevision = (dbSession.lastPersistedRevision ?? 0) + 1;

    // Update recent mutations map (bounded to last 50)
    const recentMutations: Record<string, { code: string; revision: number; lastSavedAt: Date }> = {
      ...(dbSession.workspaceSnapshot?.recentMutations || {}),
    };
    if (req.clientMutationId) {
      recentMutations[req.clientMutationId] = {
        code: req.code,
        revision: newRevision,
        lastSavedAt: now,
      };
      const keys = Object.keys(recentMutations);
      if (keys.length > 50) {
        delete recentMutations[keys[0]];
      }
    }

    const snapshot: WorkspaceSnapshot = {
      ...session.workspaceSnapshot,
      currentCode: req.code,
      lastSavedAt: now,
      revision: newRevision,
      clientMutationId: req.clientMutationId,
      recentMutations,
      lastTestTotalCount: req.testResults ? req.testResults.length : session.workspaceSnapshot.lastTestTotalCount,
      lastTestPassedCount: req.testResults ? req.testResults.filter((t) => t.passed).length : session.workspaceSnapshot.lastTestPassedCount,
    };

    // 5. Execute conditional atomic update
    const updated = await this.repo.updateWorkspaceSnapshot(sessionId, snapshot, ["ACTIVE", "in_progress"], {
      expectedBaseRevision: req.baseRevision,
    });

    if (!updated) {
      const latestDbSession = await this.repo.findById(sessionId);
      const conflictStatus = latestDbSession?.status || session.status;
      if (conflictStatus === SessionState.GRACE_PERIOD) {
        throw new SessionExpiredError("Assessment duration has elapsed. Workspace modifications are locked during grace period.");
      }
      if (conflictStatus === SessionState.FINALIZING) {
        throw new SessionLockedError(SessionState.FINALIZING, "Workspace is locked: assessment finalization is currently in progress.");
      }
      if (conflictStatus === SessionState.SUBMITTED) {
        throw new SessionLockedError(SessionState.SUBMITTED, "Workspace is permanently sealed: assessment has already been submitted.");
      }
      if (latestDbSession && new Date() > new Date(latestDbSession.expiresAt)) {
        throw new SessionExpiredError("Assessment duration has elapsed. Workspace modifications are locked.");
      }

      // Check if a concurrent request with the same clientMutationId succeeded in the race
      if (req.clientMutationId && latestDbSession?.workspaceSnapshot?.recentMutations?.[req.clientMutationId]) {
        const raceMutation = latestDbSession.workspaceSnapshot.recentMutations[req.clientMutationId];
        if (raceMutation.code === req.code) {
          session.lastPersistedRevision = raceMutation.revision;
          session.workspaceSnapshot = {
            ...latestDbSession.workspaceSnapshot,
            currentCode: raceMutation.code,
            lastSavedAt: new Date(raceMutation.lastSavedAt),
            revision: raceMutation.revision,
            clientMutationId: req.clientMutationId,
          };
          session.updatedAt = latestDbSession.updatedAt;
          return session;
        } else {
          throw new MutationIdConflictError(
            `Mutation ID '${req.clientMutationId}' was already committed with different content`
          );
        }
      }

      if (req.baseRevision !== undefined && latestDbSession && latestDbSession.lastPersistedRevision !== req.baseRevision) {
        throw new SessionStaleRevisionError(
          `Stale workspace revision rejected: incoming base revision (${req.baseRevision}) does not match currently persisted revision (${latestDbSession.lastPersistedRevision})`
        );
      }

      throw new SessionInvalidStateError(`Cannot modify workspace: session status in database is '${conflictStatus}'`);
    }

    session.lastPersistedRevision = updated.lastPersistedRevision;
    session.workspaceSnapshot = updated.workspaceSnapshot;
    session.updatedAt = updated.updatedAt;
    return session;
  }

  public submitSession(
    sessionId: string,
    req: SubmitSessionRequest
  ): AssessmentSession {
    const session = this.getSession(sessionId);

    if (session.status === SessionState.SUBMITTED) {
      return session; // Idempotent submit
    }

    if (session.status === SessionState.TERMINATED) {
      throw new SessionInvalidStateError("Terminated session cannot be submitted");
    }

    const submitDate = new Date();
    session.status = SessionState.SUBMITTED;
    session.submittedAt = submitDate;
    session.updatedAt = submitDate;
    if (req.finalCode) {
      session.workspaceSnapshot.currentCode = req.finalCode;
      session.workspaceSnapshot.lastSavedAt = submitDate;
    }

    if (req.testResults) {
      session.workspaceSnapshot.lastTestTotalCount = req.testResults.length;
      session.workspaceSnapshot.lastTestPassedCount = req.testResults.filter((t) => t.passed).length;
    }

    // Durable write-through to PostgreSQL
    this.repo
      .update(sessionId, {
        status: SessionState.SUBMITTED,
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

    if (session.status === SessionState.PAUSED) {
      return session; // Idempotent
    }

    const guardContext = {
      nowMs: Date.now(),
      expiresAtMs: new Date(session.expiresAt).getTime(),
      gracePeriodMs: (session.gracePeriodSeconds ?? 60) * 1000,
      isProctorAuthorized: true,
    };

    transitionSessionState(
      session.status,
      {
        type: "PROCTOR_PAUSE",
        reason: reason || "Proctor incident pause",
        initiatedBy: initiatedBy || "proctor",
      },
      guardContext
    );

    const now = new Date();
    const pauseReason = reason || "Proctor incident pause";
    session.status = SessionState.PAUSED;
    session.pausedAt = now;
    session.pauseReason = pauseReason;
    session.updatedAt = now;

    // Durable write-through with atomic transition
    this.repo
      .atomicTransitionState(
        sessionId,
        [SessionState.ACTIVE, SessionState.CREATED],
        SessionState.PAUSED,
        {
          pausedAt: now,
          pauseReason,
        }
      )
      .then((res) => {
        if (res.session) {
          session.stateVersion = res.session.stateVersion;
        }
      })
      .catch((err) => {
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

    if (session.status !== SessionState.PAUSED) {
      throw new SessionInvalidStateError(`Cannot resume session that is not paused (current status: '${session.status}')`);
    }

    const guardContext = {
      nowMs: Date.now(),
      expiresAtMs: new Date(session.expiresAt).getTime(),
      gracePeriodMs: (session.gracePeriodSeconds ?? 60) * 1000,
      isProctorAuthorized: true,
    };

    transitionSessionState(
      session.status,
      {
        type: "PROCTOR_RESUME",
        initiatedBy: initiatedBy || "proctor",
      },
      guardContext
    );

    const now = Date.now();
    const pausedAtMs = session.pausedAt ? new Date(session.pausedAt).getTime() : now;
    const pauseDurationMs = Math.max(0, now - pausedAtMs);

    session.totalPausedMs = (session.totalPausedMs || 0) + pauseDurationMs;
    session.expiresAt = new Date(new Date(session.expiresAt).getTime() + pauseDurationMs);
    session.pausedAt = undefined;
    session.pauseReason = undefined;
    session.status = SessionState.ACTIVE;
    session.updatedAt = new Date();

    // Durable write-through to PostgreSQL
    this.repo
      .atomicTransitionState(
        sessionId,
        [SessionState.PAUSED],
        SessionState.ACTIVE,
        {
          totalPausedMs: session.totalPausedMs,
          expiresAt: session.expiresAt,
          pausedAt: null as any,
          pauseReason: null as any,
        }
      )
      .then((res) => {
        if (res.session) {
          session.stateVersion = res.session.stateVersion;
        }
      })
      .catch((err) => {
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

  public terminateSession(sessionId: string, reason: string, initiatedBy?: string): AssessmentSession {
    const session = this.getSession(sessionId);

    const guardContext = {
      nowMs: Date.now(),
      expiresAtMs: new Date(session.expiresAt).getTime(),
      gracePeriodMs: (session.gracePeriodSeconds ?? 60) * 1000,
      isProctorAuthorized: true,
    };

    transitionSessionState(
      session.status,
      {
        type: "TERMINATE",
        reason,
        initiatedBy: initiatedBy || "proctor",
      },
      guardContext
    );

    session.status = SessionState.TERMINATED;
    session.terminationReason = reason;
    session.updatedAt = new Date();

    // Durable write-through to PostgreSQL
    this.repo
      .atomicTransitionState(
        sessionId,
        [
          SessionState.CREATED,
          SessionState.ACTIVE,
          SessionState.PAUSED,
          SessionState.GRACE_PERIOD,
          SessionState.FINALIZING,
        ],
        SessionState.TERMINATED,
        {
          terminationReason: reason,
        }
      )
      .catch((err) => {
        console.error("[AssessmentSessionService] DB terminate update error:", err);
      });

    this.eventsService?.recordEventDirect(sessionId, "session_terminated", {
      reason,
      terminatedAt: new Date().toISOString(),
      initiatedBy: initiatedBy || "proctor",
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
      if (
        session.status === SessionState.ACTIVE ||
        session.status === SessionState.CREATED ||
        session.status === SessionState.PAUSED ||
        session.status === SessionState.GRACE_PERIOD ||
        session.status === SessionState.FINALIZING
      ) {
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
    if (session.status === SessionState.ACTIVE) {
      const now = Date.now();
      const expiresAtMs = new Date(session.expiresAt).getTime();
      if (now > expiresAtMs) {
        session.status = SessionState.GRACE_PERIOD;
        session.stateVersion = (session.stateVersion || 1) + 1;
        this.repo.atomicTransitionState(session.id, [SessionState.ACTIVE], SessionState.GRACE_PERIOD).catch((err) => {
          console.error(`[AssessmentSessionService] Expiration transition error for ${session.id}:`, err);
        });
      }
    }
  }
}
