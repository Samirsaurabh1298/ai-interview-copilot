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
  "rapid_keystrokes",
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
// 2. Real-Time Integrity Score & Metrics Report
// ==============================================================================

export const IntegrityRiskLevelSchema = z.enum(["clean", "low", "medium", "high"]);
export type IntegrityRiskLevel = z.infer<typeof IntegrityRiskLevelSchema>;

export const IntegrityScoreReportSchema = z.object({
  sessionId: z.string(),
  candidateName: z.string(),
  candidateEmail: z.string(),
  status: z.string(),
  integrityScore: z.number().int().min(0).max(100),
  riskLevel: IntegrityRiskLevelSchema,
  metrics: z.object({
    totalBlurCount: z.number().int().default(0),
    totalOffScreenDurationSeconds: z.number().default(0),
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
