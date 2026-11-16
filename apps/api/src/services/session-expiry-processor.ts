import { SessionState } from "@ai-copilot/contracts";
import type { AssessmentSessionService } from "./session.js";
import type { SubmissionService } from "./submission.js";
import type { CandidateInvitationService } from "./invitation.js";
import type { SessionEventsService } from "./session-events.js";
import { SessionRepository } from "../repositories/session.repo.js";
import { SubmissionRepository } from "../repositories/submission.repo.js";

export interface SessionExpiryProcessorOptions {
  sweepIntervalMs?: number; // default: 5000 ms
  enabled?: boolean;
  stuckFinalizingTimeoutMs?: number; // default: 30000 ms
}

export interface SweepResult {
  sweptCount: number;
  finalizedCount: number;
  recoveredCount: number;
  finalizedSessionIds: string[];
  durationMs: number;
}

/**
 * Server-Authoritative Assessment Expiry & Lifecycle Processor (LOOP 10.0.4)
 *
 * Guarantees that:
 * 1. Active sessions exceeding their editing duration transition deterministically to GRACE_PERIOD.
 * 2. Sessions exceeding the hard deadline (duration + grace period) auto-finalize from the last
 *    persisted server-acknowledged snapshot.
 * 3. Sessions stuck in FINALIZING (e.g. from an API instance crash, worker restart, or timeout)
 *    are automatically discovered and recovered.
 * 4. Proctor paused sessions remain frozen until explicitly resumed.
 */
export class SessionExpiryProcessor {
  private timer: NodeJS.Timeout | null = null;
  private isSweeping = false;
  private options: Required<SessionExpiryProcessorOptions>;
  private sessionRepo: SessionRepository;
  private submissionRepo: SubmissionRepository;

  constructor(
    private sessionService: AssessmentSessionService,
    private submissionService: SubmissionService,
    private invitationService?: CandidateInvitationService,
    private eventsService?: SessionEventsService,
    options: SessionExpiryProcessorOptions = {},
    sessionRepo?: SessionRepository,
    submissionRepo?: SubmissionRepository
  ) {
    this.options = {
      sweepIntervalMs: options.sweepIntervalMs ?? 5000,
      enabled: options.enabled ?? true,
      stuckFinalizingTimeoutMs: options.stuckFinalizingTimeoutMs ?? 30000,
    };
    this.sessionRepo = sessionRepo ?? sessionService.getRepo();
    this.submissionRepo = submissionRepo ?? new SubmissionRepository();
  }

  public start(): void {
    if (!this.options.enabled || this.timer) return;
    this.timer = setInterval(() => {
      this.sweep().catch((err) => {
        console.error("[SessionExpiryProcessor] Background sweep error:", err);
      });
    }, this.options.sweepIntervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Executes an authoritative expiry sweep and stuck-finalization recovery across all sessions.
   */
  public async sweep(): Promise<SweepResult> {
    if (this.isSweeping) {
      return { sweptCount: 0, finalizedCount: 0, recoveredCount: 0, finalizedSessionIds: [], durationMs: 0 };
    }

    const startTime = Date.now();
    this.isSweeping = true;
    const finalizedSessionIds: string[] = [];
    let recoveredCount = 0;

    try {
      // 1. Crash Recovery: Detect and recover sessions stuck in FINALIZING (Phase 2 & Non-Negotiable Invariant 7)
      try {
        const stuckSessions = await this.sessionRepo.findStuckFinalizing(this.options.stuckFinalizingTimeoutMs);
        for (const stuck of stuckSessions) {
          try {
            const existingArtifact = await this.submissionRepo.findBySessionId(stuck.id);
            if (existingArtifact) {
              // Artifact was already persisted before crash; complete transition to SUBMITTED
              const res = await this.sessionRepo.atomicTransitionState(
                stuck.id,
                [SessionState.FINALIZING],
                SessionState.SUBMITTED,
                { submittedAt: existingArtifact.submittedAt }
              );
              if (res.success) {
                recoveredCount++;
                finalizedSessionIds.push(stuck.id);
                this.eventsService?.recordEventDirect(stuck.id, "session_stuck_finalization_recovered", {
                  sessionId: stuck.id,
                  recoveredAt: new Date().toISOString(),
                  reason: "Crash recovery lease timeout",
                });
              }
            } else {
              // Finalization crashed before artifact persistence; auto-finalize from last persisted snapshot
              const art = await this.submissionService.autoFinalizeSession(
                stuck.id,
                "Auto-finalized by server recovery processor after prior finalization worker lease timed out.",
                "system_recovery"
              );
              if ((art as any)?.claimedByCaller !== false) {
                recoveredCount++;
                finalizedSessionIds.push(stuck.id);
                this.eventsService?.recordEventDirect(stuck.id, "session_stuck_finalization_recovered", {
                  sessionId: stuck.id,
                  recoveredAt: new Date().toISOString(),
                  reason: "Crash recovery lease timeout",
                });
              }
            }
          } catch (err) {
            console.error(`[SessionExpiryProcessor] Failed to recover stuck session '${stuck.id}':`, err);
          }
        }
      } catch (err) {
        console.error("[SessionExpiryProcessor] Error checking stuck finalizing sessions:", err);
      }

      // 2. Lifecycle Sweep across active and grace period sessions
      const activeSessions = this.sessionService.listAllActiveSessions();

      for (const session of activeSessions) {
        // Skip sessions frozen under proctor pause
        if (session.status === SessionState.PAUSED) {
          continue;
        }

        const now = Date.now();
        const expiresAtMs = new Date(session.expiresAt).getTime();
        const gracePeriodMs = (session.gracePeriodSeconds ?? 60) * 1000;
        const hardDeadlineMs = expiresAtMs + gracePeriodMs;

        // Path A: Active session has exceeded editing duration -> transition to GRACE_PERIOD
        if (session.status === SessionState.ACTIVE && now >= expiresAtMs && now <= hardDeadlineMs) {
          try {
            const res = await this.sessionRepo.atomicTransitionState(
              session.id,
              [SessionState.ACTIVE],
              SessionState.GRACE_PERIOD
            );
            if (res.success) {
              session.status = SessionState.GRACE_PERIOD;
              if (res.session) {
                session.stateVersion = res.session.stateVersion;
              }
              this.eventsService?.recordEventDirect(session.id, "session_soft_expired", {
                sessionId: session.id,
                softExpiredAt: new Date().toISOString(),
                hardDeadlineAt: new Date(hardDeadlineMs).toISOString(),
                gracePeriodSeconds: session.gracePeriodSeconds ?? 60,
              });
            }
          } catch (err) {
            console.error(`[SessionExpiryProcessor] Soft expiry transition error for '${session.id}':`, err);
          }
        }

        // Path B: Session has exceeded hard deadline (duration + grace period) -> auto finalize
        if (
          (session.status === SessionState.ACTIVE || session.status === SessionState.GRACE_PERIOD) &&
          now > hardDeadlineMs
        ) {
          try {
            const artifact = await this.submissionService.autoFinalizeSession(
              session.id,
              "Auto-finalized by server upon hard assessment deadline expiration. Work sealed from last autosaved workspace snapshot."
            );
            if ((artifact as any)?.claimedByCaller !== false) {
              finalizedSessionIds.push(session.id);

              // Record server-authoritative audit event
              this.eventsService?.recordEventDirect(session.id, "session_auto_finalized_by_server", {
                sessionId: session.id,
                submissionId: artifact.id,
                submissionFingerprint: artifact.submissionFingerprint,
                finalizedAt: new Date().toISOString(),
                lastSnapshotSavedAt: session.workspaceSnapshot?.lastSavedAt,
                reason: "Hard deadline elapsed (duration + grace period)",
              });

              // Synchronize associated invitation to completed
              if (session.invitationId && this.invitationService) {
                this.invitationService.markInvitationCompleted(session.invitationId);
              }
            }
          } catch (err) {
            console.error(`[SessionExpiryProcessor] Failed to auto-finalize session '${session.id}':`, err);
          }
        }
      }

      return {
        sweptCount: activeSessions.length,
        finalizedCount: finalizedSessionIds.length,
        recoveredCount,
        finalizedSessionIds,
        durationMs: Date.now() - startTime,
      };
    } finally {
      this.isSweeping = false;
    }
  }
}
