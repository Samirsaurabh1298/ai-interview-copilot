import {
  pgTable,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  char,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ==============================================================================
// 1. Organizations Table
// ==============================================================================
export const organizations = pgTable(
  "organizations",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    slug: varchar("slug", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 100 }).notNull(),
    plan: varchar("plan", { length: 20 }).notNull().default("pilot"),
    settings: jsonb("settings").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_organizations_slug").on(table.slug),
  ]
);

// ==============================================================================
// 2. Organization Members Table
// ==============================================================================
export const organizationMembers = pgTable(
  "organization_members",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 128 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    role: varchar("role", { length: 30 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    invitedByMemberId: varchar("invited_by_member_id", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_org_members_org_role").on(table.organizationId, table.role),
    uniqueIndex("uniq_org_members_org_email").on(table.organizationId, table.email),
    uniqueIndex("uniq_org_members_org_user").on(table.organizationId, table.userId),
  ]
);

// ==============================================================================
// 3. Assessment Templates Table
// ==============================================================================
export const assessmentTemplates = pgTable(
  "assessment_templates",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 60 }).notNull(),
    description: text("description").notNull(),
    targetRole: varchar("target_role", { length: 80 }).notNull(),
    difficulty: varchar("difficulty", { length: 20 }).notNull().default("mid"),
    language: varchar("language", { length: 30 }).notNull().default("typescript"),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    attemptDurationMinutes: integer("attempt_duration_minutes").notNull().default(90),
    submissionDeadlineDays: integer("submission_deadline_days").notNull().default(7),
    defaultAiBudgetUsd: numeric("default_ai_budget_usd", { precision: 6, scale: 4 }).notNull().default("0.2500"),
    starterCode: text("starter_code").notNull(),
    solutionCode: text("solution_code"),
    verificationTestCode: text("verification_test_code").notNull(),
    tasks: jsonb("tasks").notNull().default([]),
    toolPolicy: jsonb("tool_policy").notNull(),
    rubricDimensionWeights: jsonb("rubric_dimension_weights").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    createdByMemberId: varchar("created_by_member_id", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_templates_org_slug").on(table.organizationId, table.slug),
    index("idx_templates_org_status").on(table.organizationId, table.status),
  ]
);

// ==============================================================================
// 4. Assessment Versions (Immutable Snapshots)
// ==============================================================================
export const assessmentVersions = pgTable(
  "assessment_versions",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    templateId: varchar("template_id", { length: 128 })
      .notNull()
      .references(() => assessmentTemplates.id, { onDelete: "cascade" }),
    organizationId: varchar("organization_id", { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    versionNumber: varchar("version_number", { length: 20 }).notNull(),
    contentHash: char("content_hash", { length: 64 }).notNull(),
    changelogNotes: text("changelog_notes"),
    snapshot: jsonb("snapshot").notNull(),
    isLocked: boolean("is_locked").notNull().default(true),
    publishedByMemberId: varchar("published_by_member_id", { length: 128 }),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_versions_template_version").on(table.templateId, table.versionNumber),
    index("idx_versions_template_id").on(table.templateId),
    index("idx_versions_org_id").on(table.organizationId),
  ]
);

// ==============================================================================
// 5. Candidate Invitations Table
// ==============================================================================
export const candidateInvitations = pgTable(
  "candidate_invitations",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    templateId: varchar("template_id", { length: 128 })
      .notNull()
      .references(() => assessmentTemplates.id, { onDelete: "cascade" }),
    versionId: varchar("version_id", { length: 128 })
      .references(() => assessmentVersions.id),
    candidateEmail: varchar("candidate_email", { length: 255 }).notNull(),
    candidateName: varchar("candidate_name", { length: 100 }).notNull(),
    invitationToken: varchar("invitation_token", { length: 128 }).notNull().unique(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    sessionId: varchar("session_id", { length: 128 }),
    invitedByMemberId: varchar("invited_by_member_id", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_invitations_token").on(table.invitationToken),
    index("idx_invitations_org_status").on(table.organizationId, table.status),
    index("idx_invitations_candidate_email").on(table.candidateEmail),
  ]
);

// ==============================================================================
// 6. Assessment Sessions Table
// ==============================================================================
export const assessmentSessions = pgTable(
  "assessment_sessions",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    templateId: varchar("template_id", { length: 128 })
      .notNull()
      .references(() => assessmentTemplates.id, { onDelete: "restrict" }),
    versionId: varchar("version_id", { length: 128 })
      .references(() => assessmentVersions.id),
    invitationId: varchar("invitation_id", { length: 128 })
      .references(() => candidateInvitations.id),
    candidateEmail: varchar("candidate_email", { length: 255 }).notNull(),
    candidateName: varchar("candidate_name", { length: 100 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("created"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    totalPausedMs: integer("total_paused_ms").notNull().default(0),
    pauseReason: text("pause_reason"),
    terminationReason: text("termination_reason"),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    gracePeriodSeconds: integer("grace_period_seconds").notNull().default(60),
    allocatedAiBudgetUsd: numeric("allocated_ai_budget_usd", { precision: 6, scale: 4 }).notNull().default("0.2500"),
    consumedAiBudgetUsd: numeric("consumed_ai_budget_usd", { precision: 8, scale: 5 }).notNull().default("0.00000"),
    toolPolicy: jsonb("tool_policy").notNull(),
    workspaceSnapshot: jsonb("workspace_snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_sessions_org_status").on(table.organizationId, table.status),
    index("idx_sessions_candidate_email").on(table.candidateEmail),
  ]
);

// ==============================================================================
// 7. Session Events Table (Append-Only Event Sourcing)
// ==============================================================================
export const sessionEvents = pgTable(
  "session_events",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    sessionId: varchar("session_id", { length: 128 })
      .notNull()
      .references(() => assessmentSessions.id, { onDelete: "cascade" }),
    sequenceNumber: integer("sequence_number").notNull(),
    type: varchar("type", { length: 40 }).notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
    payload: jsonb("payload").notNull().default({}),
  },
  (table) => [
    uniqueIndex("uniq_session_events_seq").on(table.sessionId, table.sequenceNumber),
    index("idx_session_events_session_id").on(table.sessionId),
  ]
);

// ==============================================================================
// 8. Submission Artifacts Table (Immutable Submissions)
// ==============================================================================
export const submissionArtifacts = pgTable(
  "submission_artifacts",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    sessionId: varchar("session_id", { length: 128 })
      .notNull()
      .unique()
      .references(() => assessmentSessions.id, { onDelete: "cascade" }),
    organizationId: varchar("organization_id", { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    templateId: varchar("template_id", { length: 128 }).notNull(),
    candidateName: varchar("candidate_name", { length: 100 }).notNull(),
    candidateEmail: varchar("candidate_email", { length: 255 }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
    finalCode: text("final_code").notNull(),
    starterCode: text("starter_code").notNull(),
    codeDiff: jsonb("code_diff").notNull(),
    testExecutionLog: jsonb("test_execution_log").notNull(),
    technicalExplanation: text("technical_explanation").notNull(),
    telemetrySummary: jsonb("telemetry_summary").notNull(),
    templateContentHash: char("template_content_hash", { length: 64 }).notNull(),
    submissionFingerprint: char("submission_fingerprint", { length: 64 }).notNull(),
    taskSubmissions: jsonb("task_submissions").default({}),
  },
  (table) => [
    index("idx_submissions_org_id").on(table.organizationId),
    index("idx_submissions_session_id").on(table.sessionId),
  ]
);

// ==============================================================================
// 9. Reviewer Evaluations Table (Multi-Reviewer Calibration)
// ==============================================================================
export const reviewerEvaluations = pgTable(
  "reviewer_evaluations",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    sessionId: varchar("session_id", { length: 128 })
      .notNull()
      .references(() => assessmentSessions.id, { onDelete: "cascade" }),
    organizationId: varchar("organization_id", { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reviewerId: varchar("reviewer_id", { length: 128 }).notNull(),
    reviewerName: varchar("reviewer_name", { length: 100 }).notNull(),
    reviewerEmail: varchar("reviewer_email", { length: 255 }).notNull(),
    scores: jsonb("scores").notNull(),
    weightedTotalScore: numeric("weighted_total_score", { precision: 5, scale: 2 }).notNull(),
    recommendation: varchar("recommendation", { length: 20 }).notNull(),
    summaryRationale: text("summary_rationale").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_evaluations_session_reviewer").on(table.sessionId, table.reviewerId),
    index("idx_evaluations_session_id").on(table.sessionId),
    index("idx_evaluations_org_id").on(table.organizationId),
  ]
);

// ==============================================================================
// 10. Usage Events Table (Token Ledger & Cost Analytics)
// ==============================================================================
export const usageEvents = pgTable(
  "usage_events",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 128 }),
    sessionId: varchar("session_id", { length: 128 }),
    userId: varchar("user_id", { length: 128 }),
    provider: varchar("provider", { length: 50 }).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    operation: varchar("operation", { length: 40 }).notNull(),
    inputUnits: integer("input_units").notNull().default(0),
    outputUnits: integer("output_units").notNull().default(0),
    estimatedCostUsd: numeric("estimated_cost_usd", { precision: 8, scale: 5 }).notNull().default("0.00000"),
    status: varchar("status", { length: 20 }).notNull().default("success"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_usage_events_session").on(table.sessionId),
    index("idx_usage_events_org").on(table.organizationId),
  ]
);

// ==============================================================================
// 11. Webhook Subscriptions Table
// ==============================================================================
export const webhookSubscriptions = pgTable(
  "webhook_subscriptions",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    targetUrl: varchar("target_url", { length: 2048 }).notNull(),
    secret: varchar("secret", { length: 128 }).notNull(),
    eventTypes: jsonb("event_types").notNull(),
    format: varchar("format", { length: 20 }).notNull().default("standard"),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    failureCount: integer("failure_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_webhooks_org_status").on(table.organizationId, table.status),
  ]
);

