import { z } from "zod";

// ==============================================================================
// Explicit Session States (LOOP 10.0.4)
// ==============================================================================

export const SessionState = {
  CREATED: "CREATED",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  GRACE_PERIOD: "GRACE_PERIOD",
  FINALIZING: "FINALIZING",
  SUBMITTED: "SUBMITTED",
  TERMINATED: "TERMINATED",
} as const;

export type SessionState = (typeof SessionState)[keyof typeof SessionState];

export const AssessmentSessionStateSchema = z.enum([
  "CREATED",
  "ACTIVE",
  "PAUSED",
  "GRACE_PERIOD",
  "FINALIZING",
  "SUBMITTED",
  "TERMINATED",
]);

export type AssessmentSessionState = z.infer<typeof AssessmentSessionStateSchema>;

/**
 * Normalizes input state string (handling uppercase canonical and legacy lowercase).
 */
export function normalizeSessionState(val: unknown): SessionState {
  if (typeof val !== "string") {
    throw new Error(`Invalid session state type: expected string, got ${typeof val}`);
  }
  const upper = val.toUpperCase().trim();
  if (upper === "IN_PROGRESS") return SessionState.ACTIVE;
  if (upper === "EXPIRED") return SessionState.GRACE_PERIOD;

  if (Object.values(SessionState).includes(upper as SessionState)) {
    return upper as SessionState;
  }
  throw new Error(`Unknown assessment session state: '${val}'`);
}

// ==============================================================================
// Lifecycle Events & Structured Transition Errors
// ==============================================================================

export class InvalidStateTransitionError extends Error {
  public readonly code = "INVALID_STATE_TRANSITION";
  constructor(
    public readonly currentState: SessionState,
    public readonly attemptedEvent: string,
    public readonly reason: string,
    public readonly statusCode: number = 409
  ) {
    super(`Cannot execute event '${attemptedEvent}' on session in state '${currentState}': ${reason}`);
    this.name = "InvalidStateTransitionError";
  }
}

export class SessionLockedError extends Error {
  public readonly code = "SESSION_LOCKED";
  constructor(message = "Session workspace is locked to preserve integrity", public readonly statusCode: number = 410) {
    super(message);
    this.name = "SessionLockedError";
  }
}

export type LifecycleEvent =
  | { type: "ACCEPT_INVITATION"; candidateId: string }
  | { type: "PROCTOR_PAUSE"; reason: string; initiatedBy: string }
  | { type: "PROCTOR_RESUME"; initiatedBy: string }
  | { type: "SOFT_EXPIRY"; nowMs: number }
  | { type: "START_FINALIZATION"; initiatedBy: "candidate" | "system_expiry" | "proctor"; explanation?: string }
  | { type: "FINALIZE_SUCCESS"; submissionId: string; submissionFingerprint: string }
  | { type: "RECOVER_STUCK_FINALIZATION"; reason: string }
  | { type: "TERMINATE"; reason: string; initiatedBy: string };

export interface TransitionGuardContext {
  nowMs: number;
  expiresAtMs: number;
  gracePeriodMs: number;
  isProctorAuthorized?: boolean;
}

export interface TransitionResult {
  nextState: SessionState;
  stateChanged: boolean;
  sideEffects?: {
    freezeTimer?: boolean;
    extendDeadlineMs?: number;
    lockWorkspace?: boolean;
    recordAuditEvent?: string;
  };
}

// ==============================================================================
// Authoritative State Transition Matrix
// ==============================================================================

export const ALLOWED_TRANSITIONS: Record<SessionState, ReadonlySet<LifecycleEvent["type"]>> = {
  [SessionState.CREATED]: new Set(["ACCEPT_INVITATION", "PROCTOR_PAUSE", "TERMINATE"]),
  [SessionState.ACTIVE]: new Set(["PROCTOR_PAUSE", "SOFT_EXPIRY", "START_FINALIZATION", "TERMINATE"]),
  [SessionState.PAUSED]: new Set(["PROCTOR_RESUME", "TERMINATE"]),
  [SessionState.GRACE_PERIOD]: new Set(["START_FINALIZATION", "TERMINATE"]),
  [SessionState.FINALIZING]: new Set(["FINALIZE_SUCCESS", "RECOVER_STUCK_FINALIZATION", "START_FINALIZATION"]),
  [SessionState.SUBMITTED]: new Set(["START_FINALIZATION"]), // Idempotent no-op
  [SessionState.TERMINATED]: new Set(), // Terminal
};

/**
 * Centralized, deterministic assessment lifecycle state machine transition function.
 */
export function transitionSessionState(
  currentState: SessionState,
  event: LifecycleEvent,
  context: TransitionGuardContext
): TransitionResult {
  // Terminal state guards
  if (currentState === SessionState.SUBMITTED) {
    if (event.type === "START_FINALIZATION") {
      // Idempotent re-submission returns current submitted state with no state change
      return { nextState: SessionState.SUBMITTED, stateChanged: false };
    }
    throw new InvalidStateTransitionError(
      currentState,
      event.type,
      "Assessment session has reached terminal 'SUBMITTED' state and is sealed permanently."
    );
  }

  if (currentState === SessionState.TERMINATED) {
    throw new InvalidStateTransitionError(
      currentState,
      event.type,
      "Assessment session has reached terminal 'TERMINATED' state and cannot be modified."
    );
  }

  // Validate allowed transitions
  const allowedEvents = ALLOWED_TRANSITIONS[currentState];
  if (!allowedEvents || !allowedEvents.has(event.type)) {
    throw new InvalidStateTransitionError(
      currentState,
      event.type,
      `Transition from '${currentState}' via '${event.type}' is strictly prohibited.`
    );
  }

  switch (event.type) {
    case "ACCEPT_INVITATION": {
      return {
        nextState: SessionState.ACTIVE,
        stateChanged: true,
        sideEffects: { recordAuditEvent: "session_started" },
      };
    }

    case "PROCTOR_PAUSE": {
      return {
        nextState: SessionState.PAUSED,
        stateChanged: true,
        sideEffects: { freezeTimer: true, lockWorkspace: true, recordAuditEvent: "session_paused" },
      };
    }

    case "PROCTOR_RESUME": {
      return {
        nextState: SessionState.ACTIVE,
        stateChanged: true,
        sideEffects: { freezeTimer: false, lockWorkspace: false, recordAuditEvent: "session_resumed" },
      };
    }

    case "SOFT_EXPIRY": {
      if (context.nowMs < context.expiresAtMs) {
        throw new InvalidStateTransitionError(
          currentState,
          event.type,
          `Cannot transition to GRACE_PERIOD before duration expires (${context.nowMs} < ${context.expiresAtMs})`
        );
      }
      return {
        nextState: SessionState.GRACE_PERIOD,
        stateChanged: true,
        sideEffects: { lockWorkspace: true, recordAuditEvent: "session_soft_expired" },
      };
    }

    case "START_FINALIZATION": {
      if (currentState === SessionState.FINALIZING) {
        // Concurrency deduplication: already finalizing
        return { nextState: SessionState.FINALIZING, stateChanged: false };
      }
      return {
        nextState: SessionState.FINALIZING,
        stateChanged: true,
        sideEffects: { lockWorkspace: true, recordAuditEvent: "session_finalization_started" },
      };
    }

    case "FINALIZE_SUCCESS": {
      return {
        nextState: SessionState.SUBMITTED,
        stateChanged: true,
        sideEffects: { lockWorkspace: true, recordAuditEvent: "session_submitted" },
      };
    }

    case "RECOVER_STUCK_FINALIZATION": {
      return {
        nextState: SessionState.FINALIZING,
        stateChanged: true,
        sideEffects: { recordAuditEvent: "session_stuck_finalization_recovered" },
      };
    }

    case "TERMINATE": {
      return {
        nextState: SessionState.TERMINATED,
        stateChanged: true,
        sideEffects: { lockWorkspace: true, recordAuditEvent: "session_terminated" },
      };
    }
  }
}
