import crypto from "node:crypto";
import type {
  AiCostAnalytics,
  ModelCostBreakdown,
  TrackCostBreakdown,
  DailyBurnRateItem,
  CostAnomalyItem,
} from "@ai-copilot/contracts";
import type { UsageLedgerService } from "./ledger.js";
import type { AssessmentSessionService } from "./session.js";
import type { AssessmentTemplateService } from "./template.js";
import type { OrganizationService } from "./organization.js";

export class AICostAnalyticsService {
  constructor(
    private ledgerService: UsageLedgerService,
    private sessionService: AssessmentSessionService,
    private templateService: AssessmentTemplateService,
    private orgService: OrganizationService
  ) {}

  public getCostAnalytics(
    orgId: string,
    period: "7d" | "30d" | "all" = "30d"
  ): AiCostAnalytics {
    const org = this.orgService.getOrganizationById(orgId);
    if (!org) {
      throw new Error(`Organization '${orgId}' does not exist`);
    }

    const now = Date.now();
    const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : 365;
    const cutoffTime = now - periodDays * 24 * 60 * 60 * 1000;

    // Filter events for this organization within the time window
    const orgEvents = this.ledgerService
      .getEventsForOrg(orgId)
      .filter((e) => period === "all" || e.createdAt.getTime() >= cutoffTime);

    // Filter sessions for this organization
    const orgSessions = this.sessionService.listSessionsForOrg(orgId);

    // 1. Overall Totals
    const totalCostUsd = Number(
      orgEvents.reduce((sum, e) => sum + (e.estimatedCostUsd || 0), 0).toFixed(4)
    );
    const totalTokens = orgEvents.reduce((sum, e) => sum + e.inputUnits + e.outputUnits, 0);
    const totalQueries = orgEvents.length;

    // 2. Models Breakdown
    const modelMap = new Map<
      string,
      {
        modelId: string;
        providerId: string;
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        costUsd: number;
        queryCount: number;
      }
    >();

    for (const event of orgEvents) {
      const key = `${event.provider}:${event.model}`;
      if (!modelMap.has(key)) {
        modelMap.set(key, {
          modelId: event.model,
          providerId: event.provider,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          costUsd: 0,
          queryCount: 0,
        });
      }
      const entry = modelMap.get(key)!;
      entry.promptTokens += event.inputUnits;
      entry.completionTokens += event.outputUnits;
      entry.totalTokens += event.inputUnits + event.outputUnits;
      entry.costUsd += event.estimatedCostUsd || 0;
      entry.queryCount += 1;
    }

    const modelsBreakdown: ModelCostBreakdown[] = Array.from(modelMap.values()).map((entry) => ({
      modelId: entry.modelId,
      providerId: entry.providerId,
      promptTokens: entry.promptTokens,
      completionTokens: entry.completionTokens,
      totalTokens: entry.totalTokens,
      costUsd: Number(entry.costUsd.toFixed(4)),
      queryCount: entry.queryCount,
      percentageOfTotal:
        totalCostUsd > 0
          ? Number(((entry.costUsd / totalCostUsd) * 100).toFixed(1))
          : 0,
    }));

    // 3. Tracks Breakdown
    const trackMap = new Map<
      string,
      {
        track: string;
        sessionCount: number;
        totalCostUsd: number;
      }
    >();

    for (const session of orgSessions) {
      const template = this.templateService.getTemplateById(orgId, session.templateId);
      const track = template?.targetRole ?? "General Engineering";

      if (!trackMap.has(track)) {
        trackMap.set(track, {
          track,
          sessionCount: 0,
          totalCostUsd: 0,
        });
      }
      const entry = trackMap.get(track)!;
      entry.sessionCount += 1;
      entry.totalCostUsd += session.consumedAiBudgetUsd || 0;
    }

    const tracksBreakdown: TrackCostBreakdown[] = Array.from(trackMap.values()).map((entry) => ({
      track: entry.track,
      sessionCount: entry.sessionCount,
      totalCostUsd: Number(entry.totalCostUsd.toFixed(4)),
      avgCostPerSessionUsd:
        entry.sessionCount > 0
          ? Number((entry.totalCostUsd / entry.sessionCount).toFixed(4))
          : 0,
    }));

    // 4. Daily Burn Rate Bucketization
    const dailyMap = new Map<
      string,
      {
        date: string;
        costUsd: number;
        tokens: number;
        queryCount: number;
        sessionsActive: number;
      }
    >();

    for (const event of orgEvents) {
      const dateKey = event.createdAt.toISOString().slice(0, 10);
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: dateKey,
          costUsd: 0,
          tokens: 0,
          queryCount: 0,
          sessionsActive: 0,
        });
      }
      const day = dailyMap.get(dateKey)!;
      day.costUsd += event.estimatedCostUsd || 0;
      day.tokens += event.inputUnits + event.outputUnits;
      day.queryCount += 1;
    }

    const dailyBurnRate: DailyBurnRateItem[] = Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        ...d,
        costUsd: Number(d.costUsd.toFixed(4)),
      }));

    // 5. Monthly Budget Allocation & Forecasting
    const planBudgetMap: Record<string, number> = {
      pilot: 50.0,
      standard: 250.0,
      enterprise: 1000.0,
    };
    const allocatedMonthlyBudgetUsd =
      planBudgetMap[org.plan] ??
      (org.settings.defaultAiBudgetUsd || 0.25) * (org.settings.maxConcurrentSessions || 10) * 100;

    const budgetUtilizationPercent = Number(
      ((totalCostUsd / allocatedMonthlyBudgetUsd) * 100).toFixed(1)
    );
    const isOverBudget = totalCostUsd > allocatedMonthlyBudgetUsd;

    // Linear Spend Projection & Runway
    const daysActive = Math.max(1, dailyBurnRate.length);
    const avgDailyBurnUsd = totalCostUsd / daysActive;
    const projectedMonthlySpendUsd = Number((avgDailyBurnUsd * 30).toFixed(2));

    const remainingBudget = Math.max(0, allocatedMonthlyBudgetUsd - totalCostUsd);
    const runwayDaysRemaining =
      avgDailyBurnUsd > 0
        ? Math.min(365, Math.floor(remainingBudget / avgDailyBurnUsd))
        : 30;

    const totalSessionsEvaluated = orgSessions.filter(
      (s) => s.status === "submitted" || s.status === "expired"
    ).length;

    const avgCostPerSessionUsd =
      totalSessionsEvaluated > 0
        ? Number((totalCostUsd / totalSessionsEvaluated).toFixed(4))
        : totalCostUsd;

    // 6. Cost & Token Anomaly Detection
    const anomalies = this.detectAnomalies(orgId, orgSessions, orgEvents);

    return {
      organizationId: orgId,
      period,
      totalCostUsd,
      allocatedMonthlyBudgetUsd,
      budgetUtilizationPercent,
      projectedMonthlySpendUsd,
      runwayDaysRemaining,
      isOverBudget,
      totalTokens,
      totalQueries,
      totalSessionsEvaluated,
      avgCostPerSessionUsd,
      modelsBreakdown,
      tracksBreakdown,
      dailyBurnRate,
      anomalies,
      generatedAt: new Date(),
    };
  }

  private detectAnomalies(
    _orgId: string,
    sessions: ReturnType<AssessmentSessionService["listSessionsForOrg"]>,
    events: ReturnType<UsageLedgerService["getEventsForOrg"]>
  ): CostAnomalyItem[] {
    const anomalies: CostAnomalyItem[] = [];

    // Check for high-budget sessions
    for (const session of sessions) {
      if (session.consumedAiBudgetUsd && session.consumedAiBudgetUsd > 0.4) {
        anomalies.push({
          id: "anom_" + crypto.randomBytes(4).toString("hex"),
          sessionId: session.id,
          candidateEmail: session.candidateEmail,
          anomalyType: "budget_spike",
          severity: session.consumedAiBudgetUsd > 0.75 ? "critical" : "warning",
          description: `Candidate consumed $${session.consumedAiBudgetUsd.toFixed(2)}, exceeding the $0.40 typical ceiling.`,
          metricValue: session.consumedAiBudgetUsd,
          thresholdValue: 0.4,
          detectedAt: new Date(),
        });
      }
    }

    // Check for excessive single-query prompt tokens
    for (const event of events) {
      if (event.inputUnits > 40_000) {
        anomalies.push({
          id: "anom_" + crypto.randomBytes(4).toString("hex"),
          sessionId: event.userId ?? "unknown",
          candidateEmail: "system-observed-query@copilot.internal",
          anomalyType: "excessive_tokens",
          severity: "warning",
          description: `Single prompt payload contained ${event.inputUnits.toLocaleString()} tokens, exceeding 40k threshold.`,
          metricValue: event.inputUnits,
          thresholdValue: 40_000,
          detectedAt: event.createdAt,
        });
      }
    }

    return anomalies;
  }
}

