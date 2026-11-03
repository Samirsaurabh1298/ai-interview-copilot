CREATE TABLE "assessment_sessions" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"organization_id" varchar(128) NOT NULL,
	"template_id" varchar(128) NOT NULL,
	"version_id" varchar(128),
	"invitation_id" varchar(128),
	"candidate_email" varchar(255) NOT NULL,
	"candidate_name" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'created' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"total_paused_ms" integer DEFAULT 0 NOT NULL,
	"pause_reason" text,
	"termination_reason" text,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"grace_period_seconds" integer DEFAULT 60 NOT NULL,
	"allocated_ai_budget_usd" numeric(6, 4) DEFAULT '0.2500' NOT NULL,
	"consumed_ai_budget_usd" numeric(8, 5) DEFAULT '0.00000' NOT NULL,
	"tool_policy" jsonb NOT NULL,
	"workspace_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_templates" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"organization_id" varchar(128) NOT NULL,
	"title" varchar(120) NOT NULL,
	"slug" varchar(60) NOT NULL,
	"description" text NOT NULL,
	"target_role" varchar(80) NOT NULL,
	"difficulty" varchar(20) DEFAULT 'mid' NOT NULL,
	"language" varchar(30) DEFAULT 'typescript' NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"default_ai_budget_usd" numeric(6, 4) DEFAULT '0.2500' NOT NULL,
	"starter_code" text NOT NULL,
	"solution_code" text,
	"verification_test_code" text NOT NULL,
	"tool_policy" jsonb NOT NULL,
	"rubric_dimension_weights" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_by_member_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_versions" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"template_id" varchar(128) NOT NULL,
	"organization_id" varchar(128) NOT NULL,
	"version_number" varchar(20) NOT NULL,
	"content_hash" char(64) NOT NULL,
	"changelog_notes" text,
	"snapshot" jsonb NOT NULL,
	"is_locked" boolean DEFAULT true NOT NULL,
	"published_by_member_id" varchar(128),
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_invitations" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"organization_id" varchar(128) NOT NULL,
	"template_id" varchar(128) NOT NULL,
	"version_id" varchar(128),
	"candidate_email" varchar(255) NOT NULL,
	"candidate_name" varchar(100) NOT NULL,
	"invitation_token" varchar(128) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"session_id" varchar(128),
	"invited_by_member_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	CONSTRAINT "candidate_invitations_invitation_token_unique" UNIQUE("invitation_token")
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"organization_id" varchar(128) NOT NULL,
	"user_id" varchar(128) NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(100) NOT NULL,
	"role" varchar(30) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"invited_by_member_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"slug" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"plan" varchar(20) DEFAULT 'pilot' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "reviewer_evaluations" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"session_id" varchar(128) NOT NULL,
	"organization_id" varchar(128) NOT NULL,
	"reviewer_id" varchar(128) NOT NULL,
	"reviewer_name" varchar(100) NOT NULL,
	"reviewer_email" varchar(255) NOT NULL,
	"scores" jsonb NOT NULL,
	"weighted_total_score" numeric(5, 2) NOT NULL,
	"recommendation" varchar(20) NOT NULL,
	"summary_rationale" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_events" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"session_id" varchar(128) NOT NULL,
	"sequence_number" integer NOT NULL,
	"type" varchar(40) NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_artifacts" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"session_id" varchar(128) NOT NULL,
	"organization_id" varchar(128) NOT NULL,
	"template_id" varchar(128) NOT NULL,
	"candidate_name" varchar(100) NOT NULL,
	"candidate_email" varchar(255) NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"final_code" text NOT NULL,
	"starter_code" text NOT NULL,
	"code_diff" jsonb NOT NULL,
	"test_execution_log" jsonb NOT NULL,
	"technical_explanation" text NOT NULL,
	"telemetry_summary" jsonb NOT NULL,
	"template_content_hash" char(64) NOT NULL,
	"submission_fingerprint" char(64) NOT NULL,
	CONSTRAINT "submission_artifacts_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"organization_id" varchar(128),
	"session_id" varchar(128),
	"user_id" varchar(128),
	"provider" varchar(50) NOT NULL,
	"model" varchar(100) NOT NULL,
	"operation" varchar(40) NOT NULL,
	"input_units" integer DEFAULT 0 NOT NULL,
	"output_units" integer DEFAULT 0 NOT NULL,
	"estimated_cost_usd" numeric(8, 5) DEFAULT '0.00000' NOT NULL,
	"status" varchar(20) DEFAULT 'success' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_subscriptions" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"organization_id" varchar(128) NOT NULL,
	"target_url" varchar(2048) NOT NULL,
	"secret" varchar(128) NOT NULL,
	"event_types" jsonb NOT NULL,
	"format" varchar(20) DEFAULT 'standard' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD CONSTRAINT "assessment_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD CONSTRAINT "assessment_sessions_template_id_assessment_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."assessment_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD CONSTRAINT "assessment_sessions_version_id_assessment_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."assessment_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD CONSTRAINT "assessment_sessions_invitation_id_candidate_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."candidate_invitations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_templates" ADD CONSTRAINT "assessment_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_versions" ADD CONSTRAINT "assessment_versions_template_id_assessment_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."assessment_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_versions" ADD CONSTRAINT "assessment_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_invitations" ADD CONSTRAINT "candidate_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_invitations" ADD CONSTRAINT "candidate_invitations_template_id_assessment_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."assessment_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_invitations" ADD CONSTRAINT "candidate_invitations_version_id_assessment_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."assessment_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviewer_evaluations" ADD CONSTRAINT "reviewer_evaluations_session_id_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviewer_evaluations" ADD CONSTRAINT "reviewer_evaluations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_session_id_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_artifacts" ADD CONSTRAINT "submission_artifacts_session_id_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_artifacts" ADD CONSTRAINT "submission_artifacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sessions_org_status" ON "assessment_sessions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_sessions_candidate_email" ON "assessment_sessions" USING btree ("candidate_email");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_templates_org_slug" ON "assessment_templates" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "idx_templates_org_status" ON "assessment_templates" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_versions_template_version" ON "assessment_versions" USING btree ("template_id","version_number");--> statement-breakpoint
CREATE INDEX "idx_versions_template_id" ON "assessment_versions" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_versions_org_id" ON "assessment_versions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_invitations_token" ON "candidate_invitations" USING btree ("invitation_token");--> statement-breakpoint
CREATE INDEX "idx_invitations_org_status" ON "candidate_invitations" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_invitations_candidate_email" ON "candidate_invitations" USING btree ("candidate_email");--> statement-breakpoint
CREATE INDEX "idx_org_members_org_role" ON "organization_members" USING btree ("organization_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_org_members_org_email" ON "organization_members" USING btree ("organization_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_org_members_org_user" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_organizations_slug" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_evaluations_session_reviewer" ON "reviewer_evaluations" USING btree ("session_id","reviewer_id");--> statement-breakpoint
CREATE INDEX "idx_evaluations_session_id" ON "reviewer_evaluations" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_evaluations_org_id" ON "reviewer_evaluations" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_session_events_seq" ON "session_events" USING btree ("session_id","sequence_number");--> statement-breakpoint
CREATE INDEX "idx_session_events_session_id" ON "session_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_submissions_org_id" ON "submission_artifacts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_submissions_session_id" ON "submission_artifacts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_usage_events_session" ON "usage_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_usage_events_org" ON "usage_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_webhooks_org_status" ON "webhook_subscriptions" USING btree ("organization_id","status");