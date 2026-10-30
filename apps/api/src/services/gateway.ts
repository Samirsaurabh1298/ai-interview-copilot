import type {
  SessionBudgetStatus,
  ToolPolicy,
} from "@ai-copilot/contracts";
import { AIProviderError } from "@ai-copilot/ai-core";

export interface RateCard {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
}

export const PROVIDER_RATE_CARDS: Record<string, RateCard> = {
  "gpt-4o": { inputPerMillionUsd: 2.5, outputPerMillionUsd: 10.0 },
  "gpt-4o-mini": { inputPerMillionUsd: 0.15, outputPerMillionUsd: 0.60 },
  "claude-3-5-sonnet-20241022": { inputPerMillionUsd: 3.0, outputPerMillionUsd: 15.0 },
  "gemini-2.0-flash": { inputPerMillionUsd: 0.1, outputPerMillionUsd: 0.4 },
  "qwen/qwen3.8-27b": { inputPerMillionUsd: 0.1, outputPerMillionUsd: 0.4 },
  "openai/gpt-oss-120b": { inputPerMillionUsd: 0.2, outputPerMillionUsd: 0.8 },
  "mock-model-v1": { inputPerMillionUsd: 0.0, outputPerMillionUsd: 0.0 },
};

export interface SessionBudgetRecord {
  consumedUsd: number;
  reservedUsd: number;
  policy: ToolPolicy;
  createdAt: Date;
  activeReservations: Map<string, number>;
}

export class AIUsageGatewayService {
  private sessionBudgets = new Map<string, SessionBudgetRecord>();

  public getPolicy(sessionId?: string): ToolPolicy {
    if (sessionId && this.sessionBudgets.has(sessionId)) {
      return this.sessionBudgets.get(sessionId)!.policy;
    }
    return {
      allowedProvider: "groq",
      allowedModel: "qwen/qwen3.8-27b",
      maxBudgetUsd: 0.25,
      warningThresholdPercent: 80,
      timeLimitSeconds: 3600,
      allowInternetSearch: false,
      allowDocumentation: true,
    };
  }

  public initializeSession(
    sessionId: string,
    policy?: Partial<ToolPolicy>,
    createdAt?: Date
  ): void {
    const effectivePolicy: ToolPolicy = {
      allowedProvider: policy?.allowedProvider ?? "openai",
      allowedModel: policy?.allowedModel ?? "gpt-4o-mini",
      maxBudgetUsd: policy?.maxBudgetUsd ?? 0.25,
      warningThresholdPercent: policy?.warningThresholdPercent ?? 80,
      timeLimitSeconds: policy?.timeLimitSeconds ?? 3600,
      allowInternetSearch: policy?.allowInternetSearch ?? false,
      allowDocumentation: policy?.allowDocumentation ?? true,
    };

    this.sessionBudgets.set(sessionId, {
      consumedUsd: 0,
      reservedUsd: 0,
      policy: effectivePolicy,
      createdAt: createdAt ?? new Date(),
      activeReservations: new Map(),
    });
  }

  public getBudgetStatus(sessionId: string): SessionBudgetStatus {
    const session = this.sessionBudgets.get(sessionId);
    const maxBudgetUsd = session?.policy.maxBudgetUsd ?? 0.25;
    const consumedBudgetUsd = Number((session?.consumedUsd ?? 0).toFixed(5));
    const reservedBudgetUsd = Number((session?.reservedUsd ?? 0).toFixed(5));
    const effectiveTotal = consumedBudgetUsd + reservedBudgetUsd;
    const remainingBudgetUsd = Math.max(0, Number((maxBudgetUsd - effectiveTotal).toFixed(5)));
    const percentUsed = Math.min(100, Math.round((effectiveTotal / maxBudgetUsd) * 100));

    const warningThreshold = session?.policy.warningThresholdPercent ?? 80;
    const isWarningTriggered = percentUsed >= warningThreshold;
    const isExhausted = effectiveTotal >= maxBudgetUsd;

    return {
      maxBudgetUsd,
      consumedBudgetUsd,
      remainingBudgetUsd,
      percentUsed,
      isWarningTriggered,
      isExhausted,
    };
  }

  public assertCanInvokeAI(sessionId: string): void {
    const session = this.sessionBudgets.get(sessionId);
    if (session && session.policy.timeLimitSeconds > 0) {
      const elapsedSeconds = (Date.now() - session.createdAt.getTime()) / 1000;
      if (elapsedSeconds > session.policy.timeLimitSeconds) {
        throw new AIProviderError({
          message: `Candidate assessment session time limit (${session.policy.timeLimitSeconds}s) has expired. Further AI calls are locked.`,
          code: "SESSION_EXPIRED",
          provider: "gateway",
          isRetryable: false,
        });
      }
    }

    const status = this.getBudgetStatus(sessionId);
    if (status.isExhausted) {
      throw new AIProviderError({
        message: `Candidate session budget of $${status.maxBudgetUsd.toFixed(2)} USD has been exhausted. AI queries are locked. You may continue writing code, running tests, and submitting your solution.`,
        code: "QUOTA_EXHAUSTED",
        provider: "gateway",
        isRetryable: false,
      });
    }
  }

  public reserveBudget(
    sessionId: string,
    model: string,
    estimatedTokens = { input: 1000, output: 1500 }
  ): string {
    let session = this.sessionBudgets.get(sessionId);
    if (!session) {
      this.initializeSession(sessionId);
      session = this.sessionBudgets.get(sessionId)!;
    }

    // Session time limit integrity check
    if (session.policy.timeLimitSeconds > 0) {
      const elapsedSeconds = (Date.now() - session.createdAt.getTime()) / 1000;
      if (elapsedSeconds > session.policy.timeLimitSeconds) {
        throw new AIProviderError({
          message: `Candidate assessment session time limit (${session.policy.timeLimitSeconds}s) has expired. Further AI calls are locked.`,
          code: "SESSION_EXPIRED",
          provider: "gateway",
          isRetryable: false,
        });
      }
    }

    const rate = PROVIDER_RATE_CARDS[model] ?? PROVIDER_RATE_CARDS["gpt-4o-mini"] ?? {
      inputPerMillionUsd: 0.15,
      outputPerMillionUsd: 0.60,
    };

    // Calculate reservation estimate (minimum $0.001 to prevent micro-runaway)
    const estimatedCostUsd = Math.max(
      0.001,
      (estimatedTokens.input / 1_000_000) * rate.inputPerMillionUsd +
        (estimatedTokens.output / 1_000_000) * rate.outputPerMillionUsd
    );

    const projectedTotal = session.consumedUsd + session.reservedUsd + estimatedCostUsd;
    if (projectedTotal > session.policy.maxBudgetUsd) {
      throw new AIProviderError({
        message: `Candidate session budget of $${session.policy.maxBudgetUsd.toFixed(2)} USD would be exceeded by concurrent or requested query. Remaining unreserved: $${Math.max(0, session.policy.maxBudgetUsd - session.consumedUsd - session.reservedUsd).toFixed(4)} USD.`,
        code: "QUOTA_EXHAUSTED",
        provider: "gateway",
        isRetryable: false,
      });
    }

    const reservationId = "res_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();
    session.reservedUsd += estimatedCostUsd;
    session.activeReservations.set(reservationId, estimatedCostUsd);
    return reservationId;
  }

  public commitUsage(
    sessionId: string,
    reservationId: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): { costUsd: number; status: SessionBudgetStatus } {
    let session = this.sessionBudgets.get(sessionId);
    if (!session) {
      this.initializeSession(sessionId);
      session = this.sessionBudgets.get(sessionId)!;
    }

    // Release reservation
    const reservedAmount = session.activeReservations.get(reservationId) ?? 0;
    session.reservedUsd = Math.max(0, session.reservedUsd - reservedAmount);
    session.activeReservations.delete(reservationId);

    // Compute actual cost
    const rate = PROVIDER_RATE_CARDS[model] ?? {
      inputPerMillionUsd: 0.15,
      outputPerMillionUsd: 0.60,
    };
    const costUsd =
      (inputTokens / 1_000_000) * rate.inputPerMillionUsd +
      (outputTokens / 1_000_000) * rate.outputPerMillionUsd;

    session.consumedUsd += costUsd;

    return {
      costUsd: Number(costUsd.toFixed(5)),
      status: this.getBudgetStatus(sessionId),
    };
  }

  public releaseReservation(sessionId: string, reservationId: string): void {
    const session = this.sessionBudgets.get(sessionId);
    if (!session) return;
    const reservedAmount = session.activeReservations.get(reservationId) ?? 0;
    session.reservedUsd = Math.max(0, session.reservedUsd - reservedAmount);
    session.activeReservations.delete(reservationId);
  }

  public recordUsage(
    sessionId: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): { costUsd: number; status: SessionBudgetStatus } {
    const rate = PROVIDER_RATE_CARDS[model] ?? {
      inputPerMillionUsd: 2.5,
      outputPerMillionUsd: 10.0,
    };

    const costUsd =
      (inputTokens / 1_000_000) * rate.inputPerMillionUsd +
      (outputTokens / 1_000_000) * rate.outputPerMillionUsd;

    const session = this.sessionBudgets.get(sessionId);
    if (session) {
      session.consumedUsd += costUsd;
    } else {
      this.initializeSession(sessionId);
      const newSession = this.sessionBudgets.get(sessionId)!;
      newSession.consumedUsd += costUsd;
    }

    return {
      costUsd: Number(costUsd.toFixed(5)),
      status: this.getBudgetStatus(sessionId),
    };
  }
}

