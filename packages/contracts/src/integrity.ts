import { z } from "zod";

// ==============================================================================
// 1. Integrity Incidents & Proctoring Schemas (LOOP 7)
// ==============================================================================

export const IntegritySeveritySchema = z.enum(["info", "warning", "critical"]);
export type IntegritySeverity = z.infer<typeof IntegritySeveritySchema>;

export const IntegrityCategorySchema = z.enum([
  "window_blur",
  "unattributed_paste",
  "devtools_open",
  "multiple_ips",
  "manual_flag",
  "technical_issue",
]);
export type IntegrityCategory = z.infer<typeof IntegrityCategorySchema>;

export const IntegrityIncidentSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  organizationId: z.string(),
  severity: IntegritySeveritySchema.default("warning"),
  category: IntegrityCategorySchema,
  description: z.string(),
  proctorName: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.coerce.date().default(() => new Date()),
  isResolved: z.boolean().default(false),
});
export type IntegrityIncident = z.infer<typeof IntegrityIncidentSchema>;

export const CreateProctorIncidentRequestSchema = z.object({
  severity: IntegritySeveritySchema.default("warning"),
  category: IntegrityCategorySchema.default("manual_flag"),
  description: z.string().min(3),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateProctorIncidentRequest = z.infer<typeof CreateProctorIncidentRequestSchema>;

// ==============================================================================
// 2. Real-Time Telemetry & Factual Evidence Report (LOOP 10.0.1 Hardening)
// No candidate risk scores, risk levels, or typing cadence derivations.
// ==============================================================================

export const IntegrityReviewStatusSchema = z.enum(["verified", "review_recommended", "unresolved_incident"]);
export type IntegrityReviewStatus = z.infer<typeof IntegrityReviewStatusSchema>;

export const IntegrityScoreReportSchema = z.object({
  sessionId: z.string(),
  candidateName: z.string(),
  candidateEmail: z.string(),
  status: z.string(),
  reviewStatus: IntegrityReviewStatusSchema.default("verified"),
  metrics: z.object({
    totalBlurCount: z.number().int().default(0),
    totalOffScreenDurationSeconds: z.number().default(0),
    focusRatePercent: z.number().min(0).max(100).default(100),
    unattributedPasteCount: z.number().int().default(0),
    unattributedPasteChars: z.number().int().default(0),
    incidentFlagsCount: z.number().int().default(0),
    aiQueriesCount: z.number().int().default(0),
    patchesAcceptedCount: z.number().int().default(0),
  }),
  incidents: z.array(IntegrityIncidentSchema).default([]),
  evaluatedAt: z.coerce.date().default(() => new Date()),
});
export type IntegrityScoreReport = z.infer<typeof IntegrityScoreReportSchema>;

export const SessionTelemetryReportSchema = IntegrityScoreReportSchema;
export type SessionTelemetryReport = IntegrityScoreReport;

