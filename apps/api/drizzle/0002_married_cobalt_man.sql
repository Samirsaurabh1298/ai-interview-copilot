CREATE TABLE "auth_rate_limits" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "magic_link_tokens" (
	"token_hash" varchar(128) PRIMARY KEY NOT NULL,
	"member_id" varchar(128) NOT NULL,
	"org_id" varchar(128) NOT NULL,
	"email" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_autosave_mutations" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"session_id" varchar(128) NOT NULL,
	"client_mutation_id" varchar(128) NOT NULL,
	"base_revision" integer NOT NULL,
	"server_revision" integer NOT NULL,
	"request_hash" char(64) NOT NULL,
	"committed_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessment_sessions" ALTER COLUMN "status" SET DEFAULT 'CREATED';--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD COLUMN "state_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD COLUMN "finalizing_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD COLUMN "finalizing_by" varchar(128);--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD COLUMN "last_persisted_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_members" ADD COLUMN "token_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "submission_artifacts" ADD COLUMN "server_acknowledged_revision" integer;--> statement-breakpoint
ALTER TABLE "submission_artifacts" ADD COLUMN "finalized_by" varchar(128);--> statement-breakpoint
ALTER TABLE "submission_artifacts" ADD COLUMN "multi_file_changes" jsonb;--> statement-breakpoint
ALTER TABLE "submission_artifacts" ADD COLUMN "defense_responses" jsonb;--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."organization_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_autosave_mutations" ADD CONSTRAINT "session_autosave_mutations_session_id_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_magic_link_tokens_member" ON "magic_link_tokens" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_magic_link_tokens_expires" ON "magic_link_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_session_mutation" ON "session_autosave_mutations" USING btree ("session_id","client_mutation_id");--> statement-breakpoint
CREATE INDEX "idx_session_mutations_session" ON "session_autosave_mutations" USING btree ("session_id");