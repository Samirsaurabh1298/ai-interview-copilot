import { useReducer } from "react";
import { normalizeSessionState } from "@ai-copilot/contracts";

export type WorkspaceLifecycleStatus =
  | "CREATED"
  | "ACTIVE"
  | "PAUSED"
  | "GRACE_PERIOD"
  | "FINALIZING"
  | "SUBMITTED"
  | "TERMINATED";

export interface LifecycleState {
  status: WorkspaceLifecycleStatus;
  timeLeftSeconds: number;
  isReadOnly: boolean;
  canSubmit: boolean;
  isTerminal: boolean;
  isPaused: boolean;
  inGracePeriod: boolean;
  isExpired: boolean;
  pauseReason: string | null;
  serverTimestamp?: string;
}

export type LifecycleAction =
  | {
      type: "INIT";
      payload: {
        status: string;
        remainingSeconds: number;
        isPaused?: boolean;
        pauseReason?: string | null;
      };
    }
  | { type: "TICK" }
  | {
      type: "HEARTBEAT_SYNC";
      payload: {
        status: string;
        remainingSeconds?: number;
        isExpired: boolean;
        inGracePeriod: boolean;
        isPaused: boolean;
        pauseReason?: string | null;
        serverTimestamp?: string;
      };
    }
  | { type: "START_SUBMIT" }
  | { type: "SUBMIT_SUCCESS"; payload?: any }
  | { type: "SUBMIT_FAILURE"; payload?: { message: string } }
  | { type: "PROCTOR_PAUSE"; payload?: { reason: string } }
  | { type: "PROCTOR_RESUME" }
  | { type: "TERMINATE"; payload?: { reason: string } };

export function parseStatusToLifecycle(rawStatus?: string): WorkspaceLifecycleStatus {
  if (!rawStatus) return "ACTIVE";
  try {
    const norm = normalizeSessionState(rawStatus);
    return norm as WorkspaceLifecycleStatus;
  } catch {
    const upper = rawStatus.toUpperCase().trim();
    if (upper === "IN_PROGRESS") return "ACTIVE";
    if (upper === "EXPIRED") return "GRACE_PERIOD";
    if (upper === "SUBMITTED") return "SUBMITTED";
    if (upper === "PAUSED") return "PAUSED";
    if (upper === "TERMINATED") return "TERMINATED";
    return "ACTIVE";
  }
}

export function assessmentLifecycleReducer(
  state: LifecycleState,
  action: LifecycleAction
): LifecycleState {
  switch (action.type) {
    case "INIT": {
      const status = parseStatusToLifecycle(action.payload.status);
      const isTerminal = status === "SUBMITTED" || status === "TERMINATED";
      const isPaused = status === "PAUSED" || Boolean(action.payload.isPaused);
      const inGracePeriod = status === "GRACE_PERIOD";
      const isExpired = inGracePeriod || status === "FINALIZING" || isTerminal || action.payload.remainingSeconds <= 0;
      const isReadOnly = status !== "ACTIVE";
      const canSubmit = (status === "ACTIVE" || status === "GRACE_PERIOD") && !isTerminal;

      return {
        status,
        timeLeftSeconds: isTerminal ? 0 : Math.max(0, action.payload.remainingSeconds),
        isReadOnly,
        canSubmit,
        isTerminal,
        isPaused,
        inGracePeriod,
        isExpired,
        pauseReason: action.payload.pauseReason || null,
      };
    }

    case "TICK": {
      if (state.isTerminal || state.isPaused || state.status !== "ACTIVE") {
        return state;
      }
      const nextTime = Math.max(0, state.timeLeftSeconds - 1);
      if (nextTime <= 0) {
        // Transition into GRACE_PERIOD upon duration expiry
        return {
          ...state,
          status: "GRACE_PERIOD",
          timeLeftSeconds: 0,
          inGracePeriod: true,
          isExpired: true,
          isReadOnly: true,
          canSubmit: true,
        };
      }
      return {
        ...state,
        timeLeftSeconds: nextTime,
      };
    }

    case "HEARTBEAT_SYNC": {
      // Terminal states cannot be overridden by heartbeat
      if (state.isTerminal) {
        return state;
      }

      const nextStatus = parseStatusToLifecycle(action.payload.status);
      const isTerminal = nextStatus === "SUBMITTED" || nextStatus === "TERMINATED";
      const isPaused = nextStatus === "PAUSED" || Boolean(action.payload.isPaused);
      const inGracePeriod = nextStatus === "GRACE_PERIOD" || action.payload.inGracePeriod;
      const isExpired = inGracePeriod || nextStatus === "FINALIZING" || isTerminal || action.payload.isExpired;
      const isReadOnly = nextStatus !== "ACTIVE";
      const canSubmit = (nextStatus === "ACTIVE" || nextStatus === "GRACE_PERIOD") && !isTerminal;

      return {
        ...state,
        status: nextStatus,
        timeLeftSeconds: isTerminal
          ? 0
          : action.payload.remainingSeconds !== undefined
          ? Math.max(0, action.payload.remainingSeconds)
          : state.timeLeftSeconds,
        isReadOnly,
        canSubmit,
        isTerminal,
        isPaused,
        inGracePeriod,
        isExpired,
        pauseReason: action.payload.pauseReason || state.pauseReason,
        ...(action.payload.serverTimestamp !== undefined
          ? { serverTimestamp: action.payload.serverTimestamp }
          : {}),
      };
    }

    case "START_SUBMIT": {
      if (state.isTerminal) return state;
      return {
        ...state,
        status: "FINALIZING",
        isReadOnly: true,
        canSubmit: false,
      };
    }

    case "SUBMIT_SUCCESS": {
      return {
        ...state,
        status: "SUBMITTED",
        timeLeftSeconds: 0,
        isReadOnly: true,
        canSubmit: false,
        isTerminal: true,
        isExpired: false,
        inGracePeriod: false,
      };
    }

    case "SUBMIT_FAILURE": {
      if (state.isTerminal) return state;
      const fallbackStatus = state.inGracePeriod ? "GRACE_PERIOD" : "ACTIVE";
      return {
        ...state,
        status: fallbackStatus,
        isReadOnly: fallbackStatus !== "ACTIVE",
        canSubmit: true,
      };
    }

    case "PROCTOR_PAUSE": {
      if (state.isTerminal) return state;
      return {
        ...state,
        status: "PAUSED",
        isPaused: true,
        isReadOnly: true,
        canSubmit: false,
        pauseReason: action.payload?.reason || state.pauseReason,
      };
    }

    case "PROCTOR_RESUME": {
      if (state.isTerminal) return state;
      return {
        ...state,
        status: "ACTIVE",
        isPaused: false,
        isReadOnly: false,
        canSubmit: true,
        pauseReason: null,
      };
    }

    case "TERMINATE": {
      return {
        ...state,
        status: "TERMINATED",
        timeLeftSeconds: 0,
        isReadOnly: true,
        canSubmit: false,
        isTerminal: true,
      };
    }

    default:
      return state;
  }
}

export function useAssessmentLifecycle(initialConfig: {
  status?: string | undefined;
  remainingSeconds?: number | undefined;
  expiresAt?: string | Date | undefined;
  isSubmitted?: boolean | undefined;
  isPaused?: boolean | undefined;
  pauseReason?: string | null | undefined;
}) {
  const initialStatus = initialConfig.isSubmitted
    ? "SUBMITTED"
    : parseStatusToLifecycle(initialConfig.status);

  let initialSeconds = initialConfig.remainingSeconds ?? 3600;
  if (initialConfig.expiresAt && initialConfig.remainingSeconds === undefined) {
    const expMs = new Date(initialConfig.expiresAt).getTime();
    initialSeconds = Math.max(0, Math.ceil((expMs - Date.now()) / 1000));
  }
  if (initialStatus === "SUBMITTED" || initialStatus === "TERMINATED") {
    initialSeconds = 0;
  }

  const [state, dispatch] = useReducer(assessmentLifecycleReducer, {
    status: initialStatus,
    timeLeftSeconds: initialSeconds,
    isReadOnly: initialStatus !== "ACTIVE",
    canSubmit: initialStatus === "ACTIVE" || initialStatus === "GRACE_PERIOD",
    isTerminal: initialStatus === "SUBMITTED" || initialStatus === "TERMINATED",
    isPaused: initialStatus === "PAUSED" || Boolean(initialConfig.isPaused),
    inGracePeriod: initialStatus === "GRACE_PERIOD",
    isExpired: initialStatus === "GRACE_PERIOD" || initialSeconds <= 0,
    pauseReason: initialConfig.pauseReason || null,
  });

  return { state, dispatch };
}

