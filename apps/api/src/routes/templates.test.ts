import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";

describe("Assessment Template Integration Tests", () => {
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
  });

  it("automatically seeds default Frontend challenge on first query", async () => {
    const orgId = "org_seed_test_" + Date.now();

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.total).toBe(1);
    expect(body.templates[0].title).toBe("Frontend Engineer: Support Triage Queue");
    expect(body.templates[0].status).toBe("published");
    expect(body.templates[0].toolPolicy.allowedModel).toBe("gpt-4o-mini");
    expect(body.templates[0].toolPolicy.maxBudgetUsd).toBe(0.25);
  });

  it("creates, updates, and publishes a custom assessment template", async () => {
    const orgId = "org_custom_test_" + Date.now();

    // 1. Create custom template in draft status
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/templates",
      payload: {
        organizationId: orgId,
        title: "Backend Engineer: Rate Limiter Service",
        slug: "backend-rate-limiter",
        description: "Implement a token-bucket rate limiter with sliding window verification.",
        targetRole: "Backend Engineer (Node.js / TypeScript)",
        difficulty: "senior",
        language: "typescript",
        durationMinutes: 90,
        defaultAiBudgetUsd: 0.35,
        starterCode: "export class RateLimiter { checkLimit() { return false; } }",
        verificationTestCode: "test('allows 5 requests', () => {});",
      },
    });

    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body);
    expect(created.id).toMatch(/^tmpl_/);
    expect(created.status).toBe("draft");
    expect(created.durationMinutes).toBe(90);
    expect(created.defaultAiBudgetUsd).toBe(0.35);

    // 2. Update template
    const updateRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/templates/${created.id}?organizationId=${orgId}`,
      payload: {
        title: "Backend Engineer: High-Throughput Rate Limiter",
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = JSON.parse(updateRes.body);
    expect(updated.title).toBe("Backend Engineer: High-Throughput Rate Limiter");

    // 3. Publish template
    const pubRes = await app.inject({
      method: "POST",
      url: `/api/v1/templates/${created.id}/publish?organizationId=${orgId}`,
    });

    expect(pubRes.statusCode).toBe(200);
    const published = JSON.parse(pubRes.body);
    expect(published.status).toBe("published");
  });

  it("enforces tenant isolation: templates in Org A are invisible to Org B", async () => {
    const orgA = "org_iso_a_" + Date.now();
    const orgB = "org_iso_b_" + Date.now();

    // Create custom template in Org A
    const resA = await app.inject({
      method: "POST",
      url: "/api/v1/templates",
      payload: {
        organizationId: orgA,
        title: "Org A Proprietary Challenge",
        description: "Confidential interview question for Alpha Corp only.",
        targetRole: "Full Stack Engineer",
        starterCode: "export const alpha = 1;",
        verificationTestCode: "test('alpha passes', () => {});",
      },
    });
    const tmplA = JSON.parse(resA.body);

    // List templates in Org B
    const listB = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgB}`,
    });
    const bodyB = JSON.parse(listB.body);

    // Org B should NOT see Org A's proprietary challenge
    expect(bodyB.templates.some((t: any) => t.id === tmplA.id)).toBe(false);

    // Org B trying to update Org A's template directly must receive 404 Not Found
    const crossTenantUpdate = await app.inject({
      method: "PATCH",
      url: `/api/v1/templates/${tmplA.id}?organizationId=${orgB}`,
      payload: { title: "Malicious Hack Attempt" },
    });
    expect(crossTenantUpdate.statusCode).toBe(404);
  });

  it("enforces RBAC permissions: reviewers and candidates cannot mutate templates", async () => {
    // 1. Create org and members
    const orgRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: { name: "RBAC Tmpl Corp", ownerEmail: "owner@tmplt.com", ownerName: "Owner" },
    });
    const { organization } = JSON.parse(orgRes.body);

    // Add Reviewer
    await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${organization.id}/members`,
      payload: { name: "Reviewer", email: "rev@tmplt.com", role: "reviewer" },
    });

    // Get tokens for Owner vs Reviewer
    const ownerTokenRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: organization.id, email: "owner@tmplt.com" },
    });
    const { token: ownerToken } = JSON.parse(ownerTokenRes.body);

    const revTokenRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: organization.id, email: "rev@tmplt.com" },
    });
    const { token: revToken } = JSON.parse(revTokenRes.body);

    // Reviewer attempts to create a template -> 403 Forbidden
    const revCreateRes = await app.inject({
      method: "POST",
      url: "/api/v1/templates",
      headers: { Authorization: `Bearer ${revToken}` },
      payload: {
        organizationId: organization.id,
        title: "Unauthorized Challenge",
        description: "Created by reviewer without permission.",
        targetRole: "Tester",
        starterCode: "const x = 1;",
        verificationTestCode: "test('x', () => {});",
      },
    });
    expect(revCreateRes.statusCode).toBe(403);

    // Owner creates template -> 201 Created
    const ownerCreateRes = await app.inject({
      method: "POST",
      url: "/api/v1/templates",
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: {
        organizationId: organization.id,
        title: "Authorized Challenge",
        description: "Created by owner with full admin permissions.",
        targetRole: "Staff Engineer",
        starterCode: "const x = 2;",
        verificationTestCode: "test('x', () => {});",
      },
    });
    expect(ownerCreateRes.statusCode).toBe(201);
  });
});

