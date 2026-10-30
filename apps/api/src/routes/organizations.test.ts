import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";

describe("Organization & Membership Multi-Tenant Integration Tests", () => {
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

  it("creates an organization with initial owner member", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Acme Engineering",
        slug: "acme-eng-" + Date.now(),
        ownerEmail: "cto@acme.example.com",
        ownerName: "Alice Smith",
        plan: "pilot",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);

    expect(body.organization.id).toMatch(/^org_/);
    expect(body.organization.name).toBe("Acme Engineering");
    expect(body.organization.settings.defaultAiBudgetUsd).toBe(0.25);
    expect(body.ownerMember.role).toBe("owner");
    expect(body.ownerMember.email).toBe("cto@acme.example.com");
  });

  it("rejects duplicate organization slug with 409 Conflict", async () => {
    const slug = "unique-slug-" + Date.now();

    const firstRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "First Corp",
        slug,
        ownerEmail: "first@example.com",
        ownerName: "First Owner",
      },
    });
    expect(firstRes.statusCode).toBe(201);

    const dupRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Second Corp",
        slug,
        ownerEmail: "second@example.com",
        ownerName: "Second Owner",
      },
    });

    expect(dupRes.statusCode).toBe(409);
    const body = JSON.parse(dupRes.body);
    expect(body.error).toBe("ORGANIZATION_SLUG_CONFLICT");
  });

  it("resolves organization by ID and by slug", async () => {
    const slug = "lookup-corp-" + Date.now();
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Lookup Corp",
        slug,
        ownerEmail: "lookup@corp.com",
        ownerName: "Lookup Admin",
      },
    });
    const { organization } = JSON.parse(createRes.body);

    // Lookup by ID
    const byIdRes = await app.inject({
      method: "GET",
      url: `/api/v1/organizations/${organization.id}`,
    });
    expect(byIdRes.statusCode).toBe(200);
    expect(JSON.parse(byIdRes.body).name).toBe("Lookup Corp");

    // Lookup by Slug
    const bySlugRes = await app.inject({
      method: "GET",
      url: `/api/v1/organizations/by-slug/${slug}`,
    });
    expect(bySlugRes.statusCode).toBe(200);
    expect(JSON.parse(bySlugRes.body).id).toBe(organization.id);
  });

  it("invites team members and enforces tenant data isolation between organizations", async () => {
    // 1. Create Organization Alpha
    const alphaRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Alpha Corp",
        ownerEmail: "alpha@corp.com",
        ownerName: "Alpha Lead",
      },
    });
    const { organization: orgAlpha } = JSON.parse(alphaRes.body);

    // 2. Create Organization Beta
    const betaRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Beta Corp",
        ownerEmail: "beta@corp.com",
        ownerName: "Beta Lead",
      },
    });
    const { organization: orgBeta } = JSON.parse(betaRes.body);

    // 3. Add interviewer to Alpha
    const inviteAlpha = await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${orgAlpha.id}/members`,
      payload: {
        name: "Bob Interviewer",
        email: "bob@alpha.com",
        role: "interviewer",
      },
    });
    expect(inviteAlpha.statusCode).toBe(201);
    const alphaMember = JSON.parse(inviteAlpha.body);

    // 4. Verify tenant isolation: Bob is in Alpha, NOT Beta
    const listAlpha = await app.inject({
      method: "GET",
      url: `/api/v1/organizations/${orgAlpha.id}/members`,
    });
    const listBeta = await app.inject({
      method: "GET",
      url: `/api/v1/organizations/${orgBeta.id}/members`,
    });

    const alphaMembers = JSON.parse(listAlpha.body).members;
    const betaMembers = JSON.parse(listBeta.body).members;

    expect(alphaMembers.some((m: any) => m.email === "bob@alpha.com")).toBe(true);
    expect(betaMembers.some((m: any) => m.email === "bob@alpha.com")).toBe(false);

    // 5. Attempting to update Alpha's member using Beta's tenant route must fail with 404
    const crossTenantUpdate = await app.inject({
      method: "PATCH",
      url: `/api/v1/organizations/${orgBeta.id}/members/${alphaMember.id}`,
      payload: { role: "admin" },
    });
    expect(crossTenantUpdate.statusCode).toBe(404);
  });

  it("prevents demoting or deleting the sole organization owner", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Sole Owner Org",
        ownerEmail: "sole@owner.com",
        ownerName: "Sole Owner",
      },
    });
    const { organization, ownerMember } = JSON.parse(createRes.body);

    // Attempt to demote sole owner to reviewer
    const demoteRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/organizations/${organization.id}/members/${ownerMember.id}`,
      payload: { role: "reviewer" },
    });
    expect(demoteRes.statusCode).toBe(403);
    const demoteBody = JSON.parse(demoteRes.body);
    expect(demoteBody.error).toBe("FORBIDDEN_OPERATION");

    // Attempt to delete sole owner
    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/organizations/${organization.id}/members/${ownerMember.id}`,
    });
    expect(deleteRes.statusCode).toBe(403);
    const deleteBody = JSON.parse(deleteRes.body);
    expect(deleteBody.error).toBe("FORBIDDEN_OPERATION");
  });
});

