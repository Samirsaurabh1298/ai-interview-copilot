CREATE TABLE "proctor_incidents" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"session_id" varchar(128) NOT NULL,
	"organization_id" varchar(128) NOT NULL,
	"severity" varchar(20) DEFAULT 'warning' NOT NULL,
	"category" varchar(50) DEFAULT 'manual_flag' NOT NULL,
	"description" text NOT NULL,
	"proctor_name" varchar(100),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessment_templates" ADD COLUMN "attempt_duration_minutes" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "assessment_templates" ADD COLUMN "submission_deadline_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "assessment_templates" ADD COLUMN "tasks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "submission_artifacts" ADD COLUMN "task_submissions" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "proctor_incidents" ADD CONSTRAINT "proctor_incidents_session_id_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proctor_incidents" ADD CONSTRAINT "proctor_incidents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_proctor_incidents_session" ON "proctor_incidents" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_proctor_incidents_org" ON "proctor_incidents" USING btree ("organization_id");