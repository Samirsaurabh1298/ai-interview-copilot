import type { AssessmentSessionService } from "./session.js";
import type { SubmissionService } from "./submission.js";
import type { CandidateInvitationService } from "./invitation.js";
import type { SessionEventsService } from "./session-events.js";

export interface SessionExpiryProcessorOptions {
  sweepIntervalMs?: number; // default: 5000 ms
  enabled?: boolean;
}

export interface SweepResult {
  sweptCount: number;
  finalizedCount: number;
  finalizedSessionIds: string[];
  durationMs: number;
}

/**
 * Server-Authoritative Assessment Expiry Processor (LOOP 10.0.3)
 *
 * Guarantees that any candidate assessment reaching its hard deadline
 * (duration + grace period) transitions to a terminal submitted state
 * even if the candidate's browser disconnects, disappears, or crashes.
 */
export class SessionExpiryProcessor {
  private timer: NodeJS.Timeout | null = null;
  private isSweeping = false;
  private options: Required<SessionExpiryProcessorOptions>;

  constructor(
    private sessionService: AssessmentSessionService,
    private submissionService: SubmissionService,
    private invitationService?: CandidateInvitationService,
    private eventsService?: SessionEventsService,
    options: SessionExpiryProcessorOptions = {}
  ) {
    this.options = {
      sweepIntervalMs: options.sweepIntervalMs ?? 5000,
      enabled: options.enabled ?? true,
    };
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
   * Executes an authoritative expiry sweep across all active sessions.
   */
  public async sweep(): Promise<SweepResult> {
    if (this.isSweeping) {
      return { sweptCount: 0, finalizedCount: 0, finalizedSessionIds: [], durationMs: 0 };
    }

    const startTime = Date.now();
    this.isSweeping = true;
    const finalizedSessionIds: string[] = [];

    try {
      const activeSessions = this.sessionService.listAllActiveSessions();

      for (const session of activeSessions) {
        // Skip sessions frozen under proctor pause
        if (session.status === "paused") {
          continue;
        }

        const now = Date.now();
        const expiresAtMs = new Date(session.expiresAt).getTime();
        const gracePeriodMs = (session.gracePeriodSeconds ?? 60) * 1000;
        const hardDeadlineMs = expiresAtMs + gracePeriodMs;

        // Check if session has exceeded hard deadline
        if (now > hardDeadlineMs) {
          try {
            const artifact = await this.submissionService.autoFinalizeSession(
              session.id,
              "Auto-finalized by server upon assessment window expiration. Work captured from last autosaved workspace snapshot."
            );
            finalizedSessionIds.push(session.id);

            // Record server-authoritative audit event
            this.eventsService?.recordEventDirect(session.id, "session_auto_finalized_by_server", {
              sessionId: session.id,
              submissionId: artifact.id,
              submissionFingerprint: artifact.submissionFingerprint,
              finalizedAt: new Date().toISOString(),
              lastSnapshotSavedAt: session.workspaceSnapshot.lastSavedAt,
              reason: "Hard deadline elapsed (duration + grace period)",
            });

            // Synchronize associated invitation to completed
            if (session.invitationId && this.invitationService) {
              this.invitationService.markInvitationCompleted(session.invitationId);
            }
          } catch (err) {
            console.error(`[SessionExpiryProcessor] Failed to auto-finalize session '${session.id}':`, err);
          }
        }
      }

      return {
        sweptCount: activeSessions.length,
        finalizedCount: finalizedSessionIds.length,
        finalizedSessionIds,
        durationMs: Date.now() - startTime,
      };
    } finally {
      this.isSweeping = false;
    }
  }
}

