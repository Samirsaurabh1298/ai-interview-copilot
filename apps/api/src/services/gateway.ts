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
  "claude-3-5-sonnet-20241022": { inputPerMillionUsd: 3.0, outputPerMillionUsd: 15.0 },
  "gemini-2.0-flash": { inputPerMillionUsd: 0.1, outputPerMillionUsd: 0.4 },
  "mock-model-v1": { inputPerMillionUsd: 0.0, outputPerMillionUsd: 0.0 },
};

export class AIUsageGatewayService {
  private sessionBudgets = new Map<string, { consumedUsd: number; policy: ToolPolicy }>();

  public getPolicy(sessionId?: string): ToolPolicy {
    if (sessionId && this.sessionBudgets.has(sessionId)) {
      return this.sessionBudgets.get(sessionId)!.policy;
    }
    return {
      allowedProvider: "openai",
      allowedModel: "gpt-4o",
      maxBudgetUsd: 0.25,
      warningThresholdPercent: 80,
      timeLimitSeconds: 3600,
      allowInternetSearch: false,
      allowDocumentation: true,
    };
  }

  public initializeSession(sessionId: string, policy?: Partial<ToolPolicy>): void {
    const effectivePolicy: ToolPolicy = {
      allowedProvider: policy?.allowedProvider ?? "openai",
      allowedModel: policy?.allowedModel ?? "gpt-4o",
      maxBudgetUsd: policy?.maxBudgetUsd ?? 0.25,
      warningThresholdPercent: policy?.warningThresholdPercent ?? 80,
      timeLimitSeconds: policy?.timeLimitSeconds ?? 3600,
      allowInternetSearch: policy?.allowInternetSearch ?? false,
      allowDocumentation: policy?.allowDocumentation ?? true,
    };

    this.sessionBudgets.set(sessionId, {
      consumedUsd: 0,
      policy: effectivePolicy,
    });
  }

  public getBudgetStatus(sessionId: string): SessionBudgetStatus {
    const session = this.sessionBudgets.get(sessionId);
    const maxBudgetUsd = session?.policy.maxBudgetUsd ?? 0.25;
    const consumedBudgetUsd = Number((session?.consumedUsd ?? 0).toFixed(5));
    const remainingBudgetUsd = Math.max(0, Number((maxBudgetUsd - consumedBudgetUsd).toFixed(5)));
    const percentUsed = Math.min(100, Math.round((consumedBudgetUsd / maxBudgetUsd) * 100));

    const warningThreshold = session?.policy.warningThresholdPercent ?? 80;
    const isWarningTriggered = percentUsed >= warningThreshold;
    const isExhausted = consumedBudgetUsd >= maxBudgetUsd;

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
