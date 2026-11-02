import { z } from "zod";

// ==============================================================================
// Model & Track Cost Breakdown Schemas
// ==============================================================================

export const ModelCostBreakdownSchema = z.object({
  modelId: z.string(),
  providerId: z.string(),
  promptTokens: z.number().int().min(0),
  completionTokens: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
  costUsd: z.number().min(0),
  queryCount: z.number().int().min(0),
  percentageOfTotal: z.number().min(0).max(100),
});
export type ModelCostBreakdown = z.infer<typeof ModelCostBreakdownSchema>;

export const TrackCostBreakdownSchema = z.object({
  track: z.string(),
  sessionCount: z.number().int().min(0),
  totalCostUsd: z.number().min(0),
  avgCostPerSessionUsd: z.number().min(0),
});
export type TrackCostBreakdown = z.infer<typeof TrackCostBreakdownSchema>;

// ==============================================================================
// Daily Burn Rate & Spend Velocity
// ==============================================================================

export const DailyBurnRateItemSchema = z.object({
  date: z.string(), // ISO date YYYY-MM-DD
  costUsd: z.number().min(0),
  tokens: z.number().int().min(0),
  queryCount: z.number().int().min(0),
  sessionsActive: z.number().int().min(0),
});
export type DailyBurnRateItem = z.infer<typeof DailyBurnRateItemSchema>;

// ==============================================================================
// Cost & Token Anomaly Flag Schema
// ==============================================================================

export const CostAnomalyTypeSchema = z.enum([
  "runaway_prompt_loop",
  "budget_spike",
  "excessive_tokens",
]);
export type CostAnomalyType = z.infer<typeof CostAnomalyTypeSchema>;

export const CostAnomalySeveritySchema = z.enum(["info", "warning", "critical"]);
export type CostAnomalySeverity = z.infer<typeof CostAnomalySeveritySchema>;

export const CostAnomalyItemSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  candidateEmail: z.string().email(),
  anomalyType: CostAnomalyTypeSchema,
  severity: CostAnomalySeveritySchema,
  description: z.string(),
  metricValue: z.number(),
  thresholdValue: z.number(),
  detectedAt: z.coerce.date(),
});
export type CostAnomalyItem = z.infer<typeof CostAnomalyItemSchema>;

// ==============================================================================
// Full AI Cost Analytics & Forecasting Report Schema
// ==============================================================================

export const AiCostAnalyticsSchema = z.object({
  organizationId: z.string(),
  period: z.enum(["7d", "30d", "all"]).default("30d"),
  totalCostUsd: z.number().min(0),
  allocatedMonthlyBudgetUsd: z.number().min(0),
  budgetUtilizationPercent: z.number().min(0),
  projectedMonthlySpendUsd: z.number().min(0),
  runwayDaysRemaining: z.number().min(0),
  isOverBudget: z.boolean(),
  totalTokens: z.number().int().min(0),
  totalQueries: z.number().int().min(0),
  totalSessionsEvaluated: z.number().int().min(0),
  avgCostPerSessionUsd: z.number().min(0),
  modelsBreakdown: z.array(ModelCostBreakdownSchema),
  tracksBreakdown: z.array(TrackCostBreakdownSchema),
  dailyBurnRate: z.array(DailyBurnRateItemSchema),
  anomalies: z.array(CostAnomalyItemSchema),
  generatedAt: z.coerce.date().default(() => new Date()),
});
export type AiCostAnalytics = z.infer<typeof AiCostAnalyticsSchema>;

