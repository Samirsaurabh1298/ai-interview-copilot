import crypto from "node:crypto";
import {
  type SubmissionArtifact,
  type SubmitAssessmentRequest,
  type CodeDiffSummary,
  type TaskSubmissionResult,
  SessionState,
  InvalidStateTransitionError,
  SessionLockedError,
} from "@ai-copilot/contracts";
import { CodeRunnerClient } from "@ai-copilot/code-runner";
import type { AssessmentSessionService } from "./session.js";
import type { CandidateInvitationService } from "./invitation.js";
import type { AssessmentTemplateService } from "./template.js";
import type { SessionEventsService } from "./session-events.js";
import {
  SessionNotFoundError,
  SessionExpiredError,
  SessionInvalidStateError,
} from "./session.js";
import { SubmissionRepository } from "../repositories/submission.repo.js";
import { SessionRepository } from "../repositories/session.repo.js";

const codeRunnerClient = new CodeRunnerClient();

export class SubmissionNotFoundError extends Error {
  constructor(message = "Submission not found for this session") {
    super(message);
    this.name = "SubmissionNotFoundError";
  }
}

/**
 * Computes a unified line-by-line diff between two code strings.
 */
export function computeLineDiff(original: string, modified: string): CodeDiffSummary {
  const origLines = original.split(/\r?\n/);
  const modLines = modified.split(/\r?\n/);

  let additions = 0;
  let deletions = 0;
  const diffChunks: string[] = ["--- starterCode", "+++ candidateSolution"];

  const maxLen = Math.max(origLines.length, modLines.length);
  let chunkStarted = false;

  for (let i = 0; i < maxLen; i++) {
    const orig = origLines[i];
    const mod = modLines[i];

    if (orig !== mod) {
      if (!chunkStarted) {
        diffChunks.push(`@@ -${i + 1},${Math.min(origLines.length - i, 5)} +${i + 1},${Math.min(modLines.length - i, 5)} @@`);
        chunkStarted = true;
      }
      if (orig !== undefined && mod === undefined) {
        deletions++;
        diffChunks.push(`- ${orig}`);
      } else if (orig === undefined && mod !== undefined) {
        additions++;
        diffChunks.push(`+ ${mod}`);
      } else {
        deletions++;
        additions++;
        diffChunks.push(`- ${orig}`);
        diffChunks.push(`+ ${mod}`);
      }
    } else {
      chunkStarted = false;
    }
  }

  return {
    additions,
    deletions,
    totalChanges: additions + deletions,
    unifiedDiff: diffChunks.join("\n"),
  };
}

/**
 * Produces deterministic, canonical JSON representation for cryptographic SHA-256 fingerprinting.
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    return "[" + value.map(canonicalizeJson).join(",") + "]";
  }

  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map((key) => {
    const val = (value as Record<string, unknown>)[key];
    return `${JSON.stringify(key)}:${canonicalizeJson(val)}`;
  });
  return "{" + entries.join(",") + "}";
}

export class SubmissionService {
  private submissionsBySession = new Map<string, SubmissionArtifact>();
  private inFlightSubmissions = new Map<string, Promise<SubmissionArtifact>>();
  private repo: SubmissionRepository;
  private sessionRepo: SessionRepository;
  private invitationService?: CandidateInvitationService;

  constructor(
    private sessionService: AssessmentSessionService,
    private templateService: AssessmentTemplateService,
    private eventsService: SessionEventsService,
    repo?: SubmissionRepository,
    invitationService?: CandidateInvitationService,
    sessionRepo?: SessionRepository
  ) {
    this.repo = repo ?? new SubmissionRepository();
    this.sessionRepo = sessionRepo ?? sessionService.getRepo();
    this.invitationService = invitationService;
  }

  public setInvitationService(invitationService: CandidateInvitationService): void {
    this.invitationService = invitationService;
  }

  private async executeSandboxSafely(
    code: string,
    testCode: string,
    language = "typescript",
    files?: Record<string, string>
  ): Promise<{
    status: "SUCCESS" | "FAILURE" | "NOT_RUN" | "UNAVAILABLE";
    statusReason?: string;
    success: boolean;
    passed: boolean | null;
    passedCount: number;
    totalCount: number;
    tests: Array<{ id: string; name: string; passed: boolean; message?: string }>;
    durationMs: number;
    stdout?: string;
    stderr?: string;
    exitCode: number | null;
  }> {
    const isRunnerDisabled =
      process.env.RUNNER_EXECUTION_ENABLED === "false" ||
      (process.env.RUNNER_EXECUTION_ENABLED === undefined && process.env.NODE_ENV !== "test");

    if (isRunnerDisabled) {
      return {
        status: "NOT_RUN",
        statusReason: "Automated test execution disabled pending isolated Linux gVisor worker deployment.",
        success: false,
        passed: null,
        passedCount: 0,
        totalCount: 0,
        tests: [],
        durationMs: 0,
        stdout: "",
        stderr:
          "Automated sandbox verification disabled. Candidate code preserved for reviewer rubric evaluation.",
        exitCode: null,
      };
    }

    try {
      const result = await codeRunnerClient.execute({
        code,
        ...(files && Object.keys(files).length > 0 ? { files } : {}),
        testCode,
        language,
        timeoutMs: 5000,
        memoryLimitMb: 128,
      });
      const pCount = result.tests ? result.tests.filter((t) => t.passed).length : 0;
      const tCount = result.tests ? result.tests.length : 0;
      return {
        status: result.passed ? "SUCCESS" : "FAILURE",
        statusReason: result.passed ? "All verification tests passed." : "One or more verification tests failed.",
        success: result.success ?? true,
        passed: result.passed,
        passedCount: pCount,
        totalCount: tCount,
        tests: result.tests || [],
        durationMs: result.durationMs,
        stdout: result.stdout || "",
        stderr: result.stderr || "",
        exitCode: result.exitCode ?? (result.passed ? 0 : 1),
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        status: "UNAVAILABLE",
        statusReason: `Sandbox runner unavailable: ${errorMsg}`,
        success: false,
        passed: null,
        passedCount: 0,
        totalCount: 0,
        tests: [],
        durationMs: 0,
        stdout: "",
        stderr: `Automated sandbox verification unavailable: ${errorMsg}. Candidate code preserved for reviewer rubric evaluation.`,
        exitCode: null,
      };
    }
  }

  public async loadFromDatabase(sessionId?: string): Promise<void> {
    try {
      if (sessionId) {
        const artifact = await this.repo.findBySessionId(sessionId);
        if (artifact) {
          this.submissionsBySession.set(sessionId, artifact);
        }
      } else {
        const artifacts = await this.repo.listAll();
        for (const a of artifacts) {
          this.submissionsBySession.set(a.sessionId, a);
        }
      }
    } catch (err) {
      console.error("[SubmissionService] Failed to load from database:", err);
    }
  }

  public async autoFinalizeSession(
    sessionId: string,
    reason?: string,
    finalizedBy: string = "system_expiry"
  ): Promise<SubmissionArtifact> {
    const session = this.sessionService.getSession(sessionId);

    // If already submitted, return existing
    const existing = this.submissionsBySession.get(sessionId);
    if (existing && session.status === SessionState.SUBMITTED) {
      return existing;
    }

    const snapshotCode = session.workspaceSnapshot?.currentCode || "";
    const explanation =
      reason ||
      "Auto-finalized by server upon assessment window expiration. Work captured from last autosaved workspace snapshot.";

    return this.submitAssessment(sessionId, {
      finalCode: snapshotCode,
      technicalExplanation: explanation,
      finalizedBy,
    });
  }

  public async submitAssessment(
    sessionId: string,
    req: SubmitAssessmentRequest
  ): Promise<SubmissionArtifact> {
    const session = this.sessionService.getSession(sessionId);

    // If already submitted in memory, return existing immutable artifact
    const existing = this.submissionsBySession.get(sessionId);
    if (existing && session.status === SessionState.SUBMITTED) {
      return Object.assign({}, existing, { claimedByCaller: false });
    }

    // Check DB for existing artifact (e.g. from prior submission or peer instance)
    const dbArtifact = await this.repo.findBySessionId(sessionId);
    if (dbArtifact) {
      this.submissionsBySession.set(sessionId, dbArtifact);
      session.status = SessionState.SUBMITTED;
      return Object.assign({}, dbArtifact, { claimedByCaller: false });
    }

    if (session.status === SessionState.TERMINATED) {
      throw new SessionInvalidStateError("Cannot submit a terminated session");
    }

    if (session.status === SessionState.PAUSED) {
      throw new SessionInvalidStateError("Cannot submit a session while paused by proctor");
    }

    // In-memory Promise deduplication (fast-path optimization for concurrent requests in same process)
    const inFlight = this.inFlightSubmissions.get(sessionId);
    if (inFlight) {
      const art = await inFlight;
      return Object.assign({}, art, { claimedByCaller: false });
    }

    // Database-level CAS transition: ACTIVE or GRACE_PERIOD (or FINALIZING for crash recovery) -> FINALIZING
    const isRecovery = req.finalizedBy === "system_recovery";
    const allowedFromStates = isRecovery
      ? [SessionState.ACTIVE, SessionState.GRACE_PERIOD, SessionState.FINALIZING]
      : [SessionState.ACTIVE, SessionState.GRACE_PERIOD];

    const transitionResult = await this.sessionRepo.atomicTransitionState(
      sessionId,
      allowedFromStates,
      SessionState.FINALIZING,
      {
        finalizingAt: new Date(),
        finalizingBy: req.finalizedBy || "candidate",
      }
    );

    if (!transitionResult.success) {
      const conflictState = transitionResult.conflictSession?.status || session.status;

      // If conflicting state is SUBMITTED, fetch and return the artifact
      if (conflictState === SessionState.SUBMITTED) {
        const artifact = await this.repo.findBySessionId(sessionId);
        if (artifact) {
          this.submissionsBySession.set(sessionId, artifact);
          session.status = SessionState.SUBMITTED;
          return Object.assign({}, artifact, { claimedByCaller: false });
        }
      }

      // If conflicting state is FINALIZING, another API instance/worker is currently processing it
      if (conflictState === SessionState.FINALIZING) {
        for (let attempt = 0; attempt < 25; attempt++) {
          await new Promise((r) => setTimeout(r, 200));
          const artifact = await this.repo.findBySessionId(sessionId);
          if (artifact) {
            this.submissionsBySession.set(sessionId, artifact);
            session.status = SessionState.SUBMITTED;
            return Object.assign({}, artifact, { claimedByCaller: false });
          }
        }
        throw new InvalidStateTransitionError(
          SessionState.FINALIZING,
          "START_FINALIZATION",
          "Session is currently being finalized by another worker instance"
        );
      }

      if (conflictState === SessionState.TERMINATED) {
        throw new SessionInvalidStateError("Cannot submit a terminated session");
      }

      if (conflictState === SessionState.PAUSED) {
        throw new SessionInvalidStateError("Cannot submit a session while paused by proctor");
      }

      throw new InvalidStateTransitionError(
        conflictState,
        "START_FINALIZATION",
        "Session is not in an active or grace period state"
      );
    }

    // Track wasGracePeriod to enforce Non-Negotiable Invariant 3:
    // Grace period permits only submission of previously persisted server-acknowledged work.
    const wasGracePeriod = session.status === SessionState.GRACE_PERIOD;
    session.status = SessionState.FINALIZING;
    if (transitionResult.session) {
      session.stateVersion = transitionResult.session.stateVersion;
    }

    const executionPromise = this.executeSubmissionInternal(session, req, wasGracePeriod);
    this.inFlightSubmissions.set(sessionId, executionPromise);

    try {
      return await executionPromise;
    } finally {
      this.inFlightSubmissions.delete(sessionId);
    }
  }

  private async executeSubmissionInternal(
    session: ReturnType<AssessmentSessionService["getSession"]>,
    req: SubmitAssessmentRequest,
    wasGracePeriod: boolean
  ): Promise<SubmissionArtifact> {
    const sessionId = session.id;

    // 1. Fetch template for starterCode and verificationTestCode
    const template = this.templateService.getTemplateById(session.organizationId, session.templateId);
    if (!template) {
      throw new Error(`Template '${session.templateId}' not found in organization '${session.organizationId}'`);
    }

    // 1b. Evaluate multi-task submissions if present
    const evaluatedTaskSubmissions: Record<string, TaskSubmissionResult> = {};
    if (req.taskSubmissions) {
      for (const [tId, rawTaskSub] of Object.entries(req.taskSubmissions)) {
        const taskDef = template.tasks?.find((t) => t.id === tId);
        if (!taskDef) {
          evaluatedTaskSubmissions[tId] = rawTaskSub;
          continue;
        }

        if (taskDef.type === "question_set" && taskDef.config.questions) {
          let earned = 0;
          for (const q of taskDef.config.questions) {
            const candidateAns = rawTaskSub.answers?.[q.id];
            if (!candidateAns) continue;
            if (q.format === "mcq_single") {
              const correctOpt = q.options?.find((o) => o.isCorrect)?.id;
              if (correctOpt && candidateAns.selectedOptionIds?.[0] === correctOpt) {
                earned += q.points;
              }
            } else if (q.format === "mcq_multi") {
              const correctOpts = (q.options?.filter((o) => o.isCorrect).map((o) => o.id) || []).sort();
              const candOpts = [...(candidateAns.selectedOptionIds || [])].sort();
              if (JSON.stringify(correctOpts) === JSON.stringify(candOpts)) {
                earned += q.points;
              }
            } else if (q.format === "short_text") {
              if (candidateAns.textResponse && candidateAns.textResponse.trim().length >= 10) {
                earned += Math.round(q.points * 0.8);
              }
            }
          }
          evaluatedTaskSubmissions[tId] = {
            ...rawTaskSub,
            earnedPoints: earned,
            maxPoints: taskDef.points,
            status: "completed",
            completedAt: new Date(),
          };
        } else if (taskDef.type === "coding_challenge" && rawTaskSub.codeSubmission) {
          const codeToValidate = rawTaskSub.codeSubmission.code;
          const fullTestCode = (taskDef.config.verificationTestCode || "") + (taskDef.config.hiddenTestCode ? "\n" + taskDef.config.hiddenTestCode : "");
          try {
            const taskSandbox = await this.executeSandboxSafely(
              codeToValidate,
              fullTestCode || template.verificationTestCode,
              taskDef.config.language || template.language || "typescript"
            );
            const pCount = taskSandbox.tests.filter((t) => t.passed).length;
            const tCount = taskSandbox.tests.length;
            const earned = tCount > 0 ? Math.round((pCount / tCount) * taskDef.points) : 0;
            evaluatedTaskSubmissions[tId] = {
              ...rawTaskSub,
              earnedPoints: earned,
              maxPoints: taskDef.points,
              status: "completed",
              completedAt: new Date(),
              codeSubmission: {
                ...rawTaskSub.codeSubmission,
                testResults: {
                  passed: taskSandbox.passed,
                  passedCount: pCount,
                  totalCount: tCount,
                  durationMs: taskSandbox.durationMs,
                  tests: taskSandbox.tests,
                },
              },
            };
          } catch {
            evaluatedTaskSubmissions[tId] = {
              ...rawTaskSub,
              status: "completed",
              completedAt: new Date(),
            };
          }
        } else if (taskDef.type === "repository_task" && rawTaskSub.finalFiles) {
          const repoCode =
            rawTaskSub.codeSubmission?.code ||
            rawTaskSub.finalFiles[taskDef.config.primaryFilePath || taskDef.config.primaryFileToEdit || "src/index.ts"] ||
            "";
          const repoTests = taskDef.config.verificationTestCode || template.verificationTestCode;
          const repoLang = taskDef.config.targetLanguage || template.language || "typescript";
          try {
            const taskSandbox = await this.executeSandboxSafely(
              repoCode,
              repoTests,
              repoLang,
              rawTaskSub.finalFiles
            );
            const pCount = taskSandbox.tests.filter((t) => t.passed).length;
            const tCount = taskSandbox.tests.length;
            const earned = tCount > 0 ? Math.round((pCount / tCount) * taskDef.points) : 0;
            evaluatedTaskSubmissions[tId] = {
              ...rawTaskSub,
              earnedPoints: earned,
              maxPoints: taskDef.points,
              status: "completed",
              completedAt: new Date(),
              codeSubmission: {
                ...(rawTaskSub.codeSubmission || { code: repoCode, language: repoLang }),
                testResults: {
                  passed: taskSandbox.passed,
                  passedCount: pCount,
                  totalCount: tCount,
                  durationMs: taskSandbox.durationMs,
                  tests: taskSandbox.tests,
                },
              },
            };
          } catch {
            evaluatedTaskSubmissions[tId] = {
              ...rawTaskSub,
              status: "completed",
              completedAt: new Date(),
            };
          }
        } else {
          evaluatedTaskSubmissions[tId] = rawTaskSub;
        }
      }
    }

    // Invariant 3: In Grace Period or hard expiry, candidate edits are NOT accepted.
    // Must seal from the last persisted server-acknowledged snapshot.
    const isServerAuthoritativeSeal =
      wasGracePeriod || req.finalizedBy === "system_expiry" || req.finalizedBy === "system_recovery";

    let effectiveCode: string;
    if (isServerAuthoritativeSeal) {
      effectiveCode = session.workspaceSnapshot?.currentCode || template.starterCode;
    } else {
      effectiveCode =
        req.finalCode ||
        Object.values(evaluatedTaskSubmissions).find((t) => t.codeSubmission?.code)?.codeSubmission?.code ||
        session.workspaceSnapshot?.currentCode ||
        template.starterCode;
    }

    const multiFileChanges = isServerAuthoritativeSeal
      ? session.workspaceSnapshot?.files || undefined
      : req.multiFileChanges ||
        (req.taskSubmissions &&
          Object.values(req.taskSubmissions).find((t: any) => t.finalFiles)?.finalFiles) ||
        session.workspaceSnapshot?.files ||
        undefined;

    // 2. Execute final code inside the isolated Node 22 sandbox to get authoritative test results
    const sandboxResult = await this.executeSandboxSafely(
      effectiveCode,
      template.verificationTestCode,
      template.language || "typescript",
      multiFileChanges
    );

    const passedCount = sandboxResult.passedCount;
    const totalCount = sandboxResult.totalCount;

    // 3. Compute code diff against template starterCode
    const codeDiff = computeLineDiff(template.starterCode, effectiveCode);

    // 4. Retrieve and aggregate all recorded telemetry events
    const events = this.eventsService.getEvents(sessionId);

    const aiQueriesCount = events.filter((e) => e.type === "ai_query").length;
    let acceptedPatches = 0;
    let rejectedPatches = 0;
    let blurCount = 0;
    let pasteCount = 0;

    for (const evt of events) {
      if (evt.type === "ai_patch_decision") {
        if (evt.payload?.decision === "accepted") acceptedPatches++;
        if (evt.payload?.decision === "rejected") rejectedPatches++;
      } else if (evt.type === "window_blur") {
        blurCount++;
      } else if (evt.type === "paste_detected") {
        pasteCount++;
      }
    }

    const telemetrySummary = {
      totalEvents: events.length,
      aiQueriesCount,
      consumedAiBudgetUsd: session.consumedAiBudgetUsd,
      patchDecisions: {
        accepted: acceptedPatches,
        rejected: rejectedPatches,
      },
      attentionMetrics: {
        blurCount,
        pasteCount,
      },
    };

    // 5. Template Content Hash
    const templateContentHash = crypto
      .createHash("sha256")
      .update(template.starterCode + "\n---TESTS---\n" + template.verificationTestCode)
      .digest("hex");

    const submissionId = `sub_${crypto.randomBytes(8).toString("hex")}_${Date.now()}`;
    const submitDate = new Date();

    // Server-acknowledged revision (Invariant 3 & Phase 3)
    const serverAcknowledgedRevision =
      session.lastPersistedRevision ?? session.workspaceSnapshot?.revision ?? 0;

    // 6. Assemble complete pre-fingerprint payload covering all evidence (Phase 3)
    const artifactDraft: Omit<SubmissionArtifact, "submissionFingerprint"> = {
      id: submissionId,
      sessionId,
      organizationId: session.organizationId,
      templateId: session.templateId,
      candidateName: session.candidateName,
      candidateEmail: session.candidateEmail,
      submittedAt: submitDate,
      finalCode: effectiveCode,
      starterCode: template.starterCode,
      codeDiff,
      taskSubmissions: Object.keys(evaluatedTaskSubmissions).length > 0 ? evaluatedTaskSubmissions : undefined,
      testExecutionLog: {
        status: sandboxResult.status,
        statusReason: sandboxResult.statusReason,
        success: sandboxResult.success,
        passed: sandboxResult.passed,
        passedCount,
        totalCount,
        durationMs: sandboxResult.durationMs,
        tests: sandboxResult.tests,
        stdout: sandboxResult.stdout,
        stderr: sandboxResult.stderr,
        exitCode: sandboxResult.exitCode,
      },
      technicalExplanation: req.technicalExplanation,
      telemetrySummary,
      templateContentHash,
      serverAcknowledgedRevision,
      finalizedBy: req.finalizedBy || (wasGracePeriod ? "candidate_grace" : "candidate"),
      multiFileChanges: multiFileChanges || undefined,
      ...(req.defenseResponses && req.defenseResponses.length > 0
        ? { defenseResponses: req.defenseResponses }
        : {}),
    };

    // 7. Compute cryptographic SHA-256 submission fingerprint
    const canonicalPayload = canonicalizeJson(artifactDraft);
    const submissionFingerprint = crypto
      .createHash("sha256")
      .update(canonicalPayload)
      .digest("hex");

    const finalArtifact: SubmissionArtifact = {
      ...artifactDraft,
      submissionFingerprint,
    };

    // 8. Transactionally persist immutable artifact and transition session state with OCC lease fencing
    const sessionPatch = {
      submittedAt: submitDate,
      workspaceSnapshot: {
        ...session.workspaceSnapshot,
        currentCode: effectiveCode,
        lastSavedAt: submitDate,
        lastTestPassedCount: passedCount,
        lastTestTotalCount: totalCount,
      },
    };

    const effectiveFinalizingBy = req.finalizedBy || "candidate";
    const sealResult = await this.repo.sealArtifactAndTransitionSession(
      finalArtifact,
      sessionPatch,
      session.stateVersion,
      effectiveFinalizingBy
    );

    if (!sealResult.success) {
      // Lease was fenced out or session status changed concurrently
      const conflictSession = await this.sessionRepo.findById(sessionId);
      if (conflictSession?.status === SessionState.SUBMITTED) {
        session.status = SessionState.SUBMITTED;
        const existingArt = await this.repo.findBySessionId(sessionId);
        if (existingArt) return Object.assign({}, existingArt, { claimedByCaller: false });
      }
      throw new InvalidStateTransitionError(
        conflictSession?.status || SessionState.FINALIZING,
        "COMPLETE_FINALIZATION",
        "Lease expired or session state was modified concurrently; finalization worker was fenced out."
      );
    }

    const createdArtifact = sealResult.artifact;
    this.submissionsBySession.set(sessionId, createdArtifact);

    // Update in-memory session
    session.status = SessionState.SUBMITTED;
    session.submittedAt = submitDate;
    session.workspaceSnapshot.currentCode = effectiveCode;
    session.workspaceSnapshot.lastSavedAt = submitDate;
    session.workspaceSnapshot.lastTestPassedCount = passedCount;
    session.workspaceSnapshot.lastTestTotalCount = totalCount;

    // 10. Synchronize associated invitation to completed
    if (session.invitationId && this.invitationService) {
      this.invitationService.markInvitationCompleted(session.invitationId);
    }

    // 11. Record submission event into telemetry audit stream
    this.eventsService.recordEventDirect(sessionId, "session_submitted", {
      submissionId,
      submissionFingerprint,
      passedCount,
      totalCount,
      totalChanges: codeDiff.totalChanges,
      aiQueriesCount,
      serverAcknowledgedRevision,
      finalizedBy: finalArtifact.finalizedBy,
    });

    return Object.assign({}, createdArtifact, { claimedByCaller: true });
  }

  public getSubmission(sessionId: string): SubmissionArtifact {
    const artifact = this.submissionsBySession.get(sessionId);
    if (!artifact) {
      throw new SubmissionNotFoundError(`No submission recorded for session '${sessionId}'`);
    }
    return artifact;
  }
}
