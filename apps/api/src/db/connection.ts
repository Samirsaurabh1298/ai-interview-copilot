import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import * as schema from "./schema.js";
import { sql } from "drizzle-orm";

const { Pool } = pg;

export type AppDatabase = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

let pool: pg.Pool | null = null;
let pgliteInstance: PGlite | null = null;
let dbInstance: AppDatabase | null = null;
let activeEngine: "postgres" | "pglite" = "pglite";
let initPromise: Promise<AppDatabase> | null = null;
let schemaInitialized = false;

/**
 * Initializes the database connection pool or embedded engine.
 * Supports standard PostgreSQL URLs (postgres:// or postgresql://)
 * as well as embedded in-memory/file PGlite (for tests or zero-daemon environments).
 * Uses a promise mutex to ensure concurrent invocations reuse the same engine initialization.
 */
export async function initDatabase(databaseUrl?: string): Promise<AppDatabase> {
  if (dbInstance && schemaInitialized) {
    return dbInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      if (!dbInstance) {
        const url = databaseUrl || process.env.DATABASE_URL;

        if (url && (url.startsWith("postgres://") || url.startsWith("postgresql://"))) {
          // 1. Production PostgreSQL with Connection Pooling
          pool = new Pool({
            connectionString: url,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
          });

          dbInstance = drizzle(pool, { schema });
          activeEngine = "postgres";
        } else {
          // 2. Embedded PostgreSQL 16 engine via PGlite (WASM)
          const dataDir = url?.startsWith("pglite://") ? url.replace("pglite://", "") : undefined;
          pgliteInstance = new PGlite(dataDir);
          dbInstance = drizzlePglite(pgliteInstance, { schema });
          activeEngine = "pglite";
        }
      }

      // Ensure all schema tables and indexes exist once per engine lifecycle
      if (!schemaInitialized) {
        await ensureSchema(dbInstance);
        schemaInitialized = true;
      }

      return dbInstance;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Returns the active Drizzle database client.
 * Auto-initializes if not yet started.
 */
export async function getDb(): Promise<AppDatabase> {
  if (!dbInstance) {
    return await initDatabase();
  }
  return dbInstance;
}

/**
 * Synchronizes schema tables to guarantee persistence readiness.
 */
async function ensureSchema(db: AppDatabase): Promise<void> {
  const ddlScript = `
    CREATE TABLE IF NOT EXISTS organizations (
      id VARCHAR(128) PRIMARY KEY,
      slug VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      plan VARCHAR(20) NOT NULL DEFAULT 'pilot',
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations (slug);

    CREATE TABLE IF NOT EXISTS organization_members (
      id VARCHAR(128) PRIMARY KEY,
      organization_id VARCHAR(128) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id VARCHAR(128) NOT NULL,
      email VARCHAR(255) NOT NULL,
      name VARCHAR(100) NOT NULL,
      role VARCHAR(30) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      invited_by_member_id VARCHAR(128),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_org_members_org_role ON organization_members (organization_id, role);
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_org_members_org_email ON organization_members (organization_id, email);
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_org_members_org_user ON organization_members (organization_id, user_id);

    CREATE TABLE IF NOT EXISTS assessment_templates (
      id VARCHAR(128) PRIMARY KEY,
      organization_id VARCHAR(128) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      title VARCHAR(120) NOT NULL,
      slug VARCHAR(60) NOT NULL,
      description TEXT NOT NULL,
      target_role VARCHAR(80) NOT NULL,
      difficulty VARCHAR(20) NOT NULL DEFAULT 'mid',
      language VARCHAR(30) NOT NULL DEFAULT 'typescript',
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      attempt_duration_minutes INTEGER NOT NULL DEFAULT 90,
      submission_deadline_days INTEGER NOT NULL DEFAULT 7,
      default_ai_budget_usd NUMERIC(6, 4) NOT NULL DEFAULT 0.2500,
      starter_code TEXT NOT NULL,
      solution_code TEXT,
      verification_test_code TEXT NOT NULL,
      tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
      tool_policy JSONB NOT NULL,
      rubric_dimension_weights JSONB NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      created_by_member_id VARCHAR(128),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uniq_templates_org_slug ON assessment_templates (organization_id, slug);
    CREATE INDEX IF NOT EXISTS idx_templates_org_status ON assessment_templates (organization_id, status);

    CREATE TABLE IF NOT EXISTS assessment_versions (
      id VARCHAR(128) PRIMARY KEY,
      template_id VARCHAR(128) NOT NULL REFERENCES assessment_templates(id) ON DELETE CASCADE,
      organization_id VARCHAR(128) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      version_number VARCHAR(20) NOT NULL,
      content_hash CHAR(64) NOT NULL,
      changelog_notes TEXT,
      snapshot JSONB NOT NULL,
      is_locked BOOLEAN NOT NULL DEFAULT TRUE,
      published_by_member_id VARCHAR(128),
      published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uniq_versions_template_version ON assessment_versions (template_id, version_number);
    CREATE INDEX IF NOT EXISTS idx_versions_template_id ON assessment_versions (template_id);
    CREATE INDEX IF NOT EXISTS idx_versions_org_id ON assessment_versions (organization_id);

    CREATE TABLE IF NOT EXISTS candidate_invitations (
      id VARCHAR(128) PRIMARY KEY,
      organization_id VARCHAR(128) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      template_id VARCHAR(128) NOT NULL REFERENCES assessment_templates(id) ON DELETE CASCADE,
      version_id VARCHAR(128) REFERENCES assessment_versions(id),
      candidate_email VARCHAR(255) NOT NULL,
      candidate_name VARCHAR(100) NOT NULL,
      invitation_token VARCHAR(128) UNIQUE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      expires_at TIMESTAMPTZ NOT NULL,
      session_id VARCHAR(128),
      invited_by_member_id VARCHAR(128),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      accepted_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_invitations_token ON candidate_invitations (invitation_token);
    CREATE INDEX IF NOT EXISTS idx_invitations_org_status ON candidate_invitations (organization_id, status);
    CREATE INDEX IF NOT EXISTS idx_invitations_candidate_email ON candidate_invitations (candidate_email);

    CREATE TABLE IF NOT EXISTS assessment_sessions (
      id VARCHAR(128) PRIMARY KEY,
      organization_id VARCHAR(128) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      template_id VARCHAR(128) NOT NULL REFERENCES assessment_templates(id) ON DELETE RESTRICT,
      version_id VARCHAR(128) REFERENCES assessment_versions(id),
      invitation_id VARCHAR(128) REFERENCES candidate_invitations(id),
      candidate_email VARCHAR(255) NOT NULL,
      candidate_name VARCHAR(100) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'created',
      started_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      submitted_at TIMESTAMPTZ,
      paused_at TIMESTAMPTZ,
      total_paused_ms INTEGER NOT NULL DEFAULT 0,
      pause_reason TEXT,
      termination_reason TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      grace_period_seconds INTEGER NOT NULL DEFAULT 60,
      allocated_ai_budget_usd NUMERIC(6, 4) NOT NULL DEFAULT 0.2500,
      consumed_ai_budget_usd NUMERIC(8, 5) NOT NULL DEFAULT 0.00000,
      tool_policy JSONB NOT NULL,
      workspace_snapshot JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_org_status ON assessment_sessions (organization_id, status);
    CREATE INDEX IF NOT EXISTS idx_sessions_candidate_email ON assessment_sessions (candidate_email);

    CREATE TABLE IF NOT EXISTS session_events (
      id VARCHAR(128) PRIMARY KEY,
      session_id VARCHAR(128) NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
      sequence_number INTEGER NOT NULL,
      type VARCHAR(40) NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      payload JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uniq_session_events_seq ON session_events (session_id, sequence_number);
    CREATE INDEX IF NOT EXISTS idx_session_events_session_id ON session_events (session_id);

    CREATE TABLE IF NOT EXISTS submission_artifacts (
      id VARCHAR(128) PRIMARY KEY,
      session_id VARCHAR(128) UNIQUE NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
      organization_id VARCHAR(128) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      template_id VARCHAR(128) NOT NULL,
      candidate_name VARCHAR(100) NOT NULL,
      candidate_email VARCHAR(255) NOT NULL,
      submitted_at TIMESTAMPTZ NOT NULL,
      final_code TEXT NOT NULL,
      starter_code TEXT NOT NULL,
      code_diff JSONB NOT NULL,
      test_execution_log JSONB NOT NULL,
      technical_explanation TEXT NOT NULL,
      telemetry_summary JSONB NOT NULL,
      template_content_hash CHAR(64) NOT NULL,
      submission_fingerprint CHAR(64) NOT NULL,
      task_submissions JSONB DEFAULT '{}'::jsonb
    );

    CREATE INDEX IF NOT EXISTS idx_submissions_org_id ON submission_artifacts (organization_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_session_id ON submission_artifacts (session_id);

    -- Safe idempotent migrations for existing databases
    ALTER TABLE assessment_templates ADD COLUMN IF NOT EXISTS tasks JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE assessment_templates ADD COLUMN IF NOT EXISTS attempt_duration_minutes INTEGER NOT NULL DEFAULT 90;
    ALTER TABLE assessment_templates ADD COLUMN IF NOT EXISTS submission_deadline_days INTEGER NOT NULL DEFAULT 7;
    ALTER TABLE submission_artifacts ADD COLUMN IF NOT EXISTS task_submissions JSONB DEFAULT '{}'::jsonb;

    CREATE TABLE IF NOT EXISTS reviewer_evaluations (
      id VARCHAR(128) PRIMARY KEY,
      session_id VARCHAR(128) NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
      organization_id VARCHAR(128) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      reviewer_id VARCHAR(128) NOT NULL,
      reviewer_name VARCHAR(100) NOT NULL,
      reviewer_email VARCHAR(255) NOT NULL,
      scores JSONB NOT NULL,
      weighted_total_score NUMERIC(5, 2) NOT NULL,
      recommendation VARCHAR(20) NOT NULL,
      summary_rationale TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uniq_evaluations_session_reviewer ON reviewer_evaluations (session_id, reviewer_id);
    CREATE INDEX IF NOT EXISTS idx_evaluations_session_id ON reviewer_evaluations (session_id);
    CREATE INDEX IF NOT EXISTS idx_evaluations_org_id ON reviewer_evaluations (organization_id);

    CREATE TABLE IF NOT EXISTS usage_events (
      id VARCHAR(128) PRIMARY KEY,
      organization_id VARCHAR(128),
      session_id VARCHAR(128),
      user_id VARCHAR(128),
      provider VARCHAR(50) NOT NULL,
      model VARCHAR(100) NOT NULL,
      operation VARCHAR(40) NOT NULL,
      input_units INTEGER NOT NULL DEFAULT 0,
      output_units INTEGER NOT NULL DEFAULT 0,
      estimated_cost_usd NUMERIC(8, 5) NOT NULL DEFAULT 0.00000,
      status VARCHAR(20) NOT NULL DEFAULT 'success',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_usage_events_session ON usage_events (session_id);
    CREATE INDEX IF NOT EXISTS idx_usage_events_org ON usage_events (organization_id);

    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id VARCHAR(128) PRIMARY KEY,
      organization_id VARCHAR(128) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      target_url VARCHAR(2048) NOT NULL,
      secret VARCHAR(128) NOT NULL,
      event_types JSONB NOT NULL,
      format VARCHAR(20) NOT NULL DEFAULT 'standard',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      failure_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_webhooks_org_status ON webhook_subscriptions (organization_id, status);
  `;

  if (pgliteInstance) {
    await pgliteInstance.exec(ddlScript);
  } else if (pool) {
    await pool.query(ddlScript);
  }
}

/**
 * Health check probe to verify active database connectivity and latency.
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  engine: "postgres" | "pglite";
  latencyMs: number;
  error?: string;
}> {
  const start = performance.now();
  try {
    const db = await getDb();
    await db.execute(sql`SELECT 1`);
    const latencyMs = Number((performance.now() - start).toFixed(2));
    return {
      healthy: true,
      engine: activeEngine,
      latencyMs,
    };
  } catch (err: unknown) {
    const latencyMs = Number((performance.now() - start).toFixed(2));
    return {
      healthy: false,
      engine: activeEngine,
      latencyMs,
      error: err instanceof Error ? err.message : "Unknown database error",
    };
  }
}

/**
 * Gracefully shuts down pool and database resources.
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
  if (pgliteInstance) {
    await pgliteInstance.close();
    pgliteInstance = null;
  }
  dbInstance = null;
  schemaInitialized = false;
  initPromise = null;
}
