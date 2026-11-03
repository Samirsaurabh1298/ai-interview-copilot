import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { checkDatabaseHealth, closeDatabase, getDb } from "./connection.js";
import { organizations, assessmentSessions, submissionArtifacts } from "./schema.js";
import { eq } from "drizzle-orm";

describe("LOOP 6.1 — Database Persistence & Durability Integration Tests", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const config = loadConfig();
    config.NODE_ENV = "test";
    config.DEFAULT_AI_PROVIDER = "mock";
    app = await buildApp(config);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await closeDatabase();
  });

  // ============================================================================
  // Test 1: Database Health Check
  // ============================================================================
  it("probes database health and returns active engine connectivity", async () => {
    const health = await checkDatabaseHealth();
    expect(health.healthy).toBe(true);
    expect(["postgres", "pglite"]).toContain(health.engine);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);

    const res = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("healthy");
    expect(body.database.healthy).toBe(true);
  });

  // ============================================================================
  // Test 2: Multi-Tenant CRUD and Foreign Key Constraints
  // ============================================================================
  it("persists organizations and enforces unique slug constraints", async () => {
    const uniqueSlug = "durable-corp-" + Date.now();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Durable Corp",
        slug: uniqueSlug,
        ownerEmail: "owner@durable.corp",
        ownerName: "Durable Owner",
        plan: "standard",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    const orgId = body.organization.id;

    // Verify row directly in PostgreSQL table via Drizzle
    const db = await getDb();
    const rows = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));

    expect(rows.length).toBe(1);
    expect(rows[0]?.slug).toBe(uniqueSlug);
    expect(rows[0]?.name).toBe("Durable Corp");

    // Verify duplicate slug rejection (409 Conflict)
    const dupRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Duplicate Corp",
        slug: uniqueSlug,
        ownerEmail: "other@durable.corp",
        ownerName: "Other Owner",
      },
    });
    expect(dupRes.statusCode).toBe(409);
  });

  // ============================================================================
  // Test 3: API Restart Durability Test (Real Process Exit / Rebuild Simulation)
  // ============================================================================
  it("guarantees persistent data survives complete API instance restart", async () => {
    const uniqueOrgSlug = "restart-test-" + Date.now();
    const testCandidateEmail = `candidate-${Date.now()}@example.com`;

    // --------------------------------------------------------------------------
    // Step 1: On Instance A, create Organization, Session, and Submission
    // --------------------------------------------------------------------------
    const orgRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Restart Validation Inc",
        slug: uniqueOrgSlug,
        ownerEmail: "admin@restart.example",
        ownerName: "Restart Admin",
      },
    });
    expect(orgRes.statusCode).toBe(201);
    const orgData = JSON.parse(orgRes.body);
    const orgId = orgData.organization.id;

    // Fetch seeded default template
    const tmplRes = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgId}`,
    });
    expect(tmplRes.statusCode).toBe(200);
    const tmplList = JSON.parse(tmplRes.body);
    const templateId = tmplList.templates[0].id;

    // Create active assessment session
    const sessRes = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {
        organizationId: orgId,
        templateId,
        candidateName: "Durability Candidate",
        candidateEmail: testCandidateEmail,
        durationMinutes: 45,
      },
    });
    expect(sessRes.statusCode).toBe(201);
    const sessionData = JSON.parse(sessRes.body);
    const sessionId = sessionData.id;

    // Autosave workspace snapshot
    const updateRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${sessionId}/workspace`,
      payload: {
        code: "function solution() { return 'durable_survived_restart'; }",
      },
    });
    expect(updateRes.statusCode).toBe(200);

    // Finalize candidate submission
    const submitRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/submit`,
      payload: {
        finalCode: "function solution() { return 'durable_survived_restart'; }",
        technicalExplanation: "Production-grade durability verified via Drizzle ORM.",
      },
    });
    expect(submitRes.statusCode).toBe(200);
    const submissionBody = JSON.parse(submitRes.body);
    expect(submissionBody.submissionFingerprint).toBeDefined();

    // Allow write-through persistence to complete
    await new Promise((r) => setTimeout(r, 100));

    // --------------------------------------------------------------------------
    // Step 2: Terminate Instance A
    // --------------------------------------------------------------------------
    await app.close();

    // --------------------------------------------------------------------------
    // Step 3: Boot Instance B (New Clean Process Simulation)
    // --------------------------------------------------------------------------
    const freshConfig = loadConfig();
    freshConfig.NODE_ENV = "test";
    freshConfig.DEFAULT_AI_PROVIDER = "mock";

    const freshApp = await buildApp(freshConfig);
    await freshApp.ready();

    try {
      // Query Instance B for the organization created on Instance A
      const verifyOrgRes = await freshApp.inject({
        method: "GET",
        url: `/api/v1/organizations/${orgId}`,
      });
      expect(verifyOrgRes.statusCode).toBe(200);
      const verifyOrg = JSON.parse(verifyOrgRes.body);
      expect(verifyOrg.id).toBe(orgId);
      expect(verifyOrg.slug).toBe(uniqueOrgSlug);

      // Verify Session survived restart on Instance B
      const verifySessRes = await freshApp.inject({
        method: "GET",
        url: `/api/v1/sessions/${sessionId}`,
      });
      expect(verifySessRes.statusCode).toBe(200);
      const verifySess = JSON.parse(verifySessRes.body);
      expect(verifySess.id).toBe(sessionId);
      expect(verifySess.status).toBe("submitted");
      expect(verifySess.workspaceSnapshot.currentCode).toBe(
        "function solution() { return 'durable_survived_restart'; }"
      );

      // Verify Submission Artifact survived restart on Instance B
      const verifySubmitRes = await freshApp.inject({
        method: "GET",
        url: `/api/v1/sessions/${sessionId}/submission`,
      });
      expect(verifySubmitRes.statusCode).toBe(200);
      const verifySubmit = JSON.parse(verifySubmitRes.body);
      expect(verifySubmit.artifact.sessionId).toBe(sessionId);
      expect(verifySubmit.artifact.candidateEmail).toBe(testCandidateEmail);
      expect(verifySubmit.artifact.submissionFingerprint).toBe(
        submissionBody.submissionFingerprint
      );
    } finally {
      await freshApp.close();
    }
  });
});
