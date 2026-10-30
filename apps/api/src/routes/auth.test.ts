import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { AuthService } from "../services/auth.js";

describe("Authentication & RBAC Integration Tests", () => {
  let app: FastifyInstance;
  let authService: AuthService;

  beforeAll(async () => {
    const config = loadConfig();
    config.NODE_ENV = "test";
    config.DEFAULT_AI_PROVIDER = "mock";
    config.JWT_SECRET = "test-jwt-super-secret-key-32chars-strictly";
    authService = new AuthService(config.JWT_SECRET);
    app = await buildApp(config);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("issues a signed JWT token on valid member credentials", async () => {
    // 1. Create organization
    const orgRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Auth Test Corp",
        ownerEmail: "owner@authtest.com",
        ownerName: "Auth Owner",
      },
    });
    const { organization, ownerMember } = JSON.parse(orgRes.body);

    // 2. Request token
    const tokenRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: {
        organizationId: organization.id,
        email: "owner@authtest.com",
      },
    });

    expect(tokenRes.statusCode).toBe(200);
    const body = JSON.parse(tokenRes.body);

    expect(body.token).toBeDefined();
    expect(body.token.split(".")).toHaveLength(3); // Valid JWT structure
    expect(body.tokenType).toBe("Bearer");
    expect(body.user.userId).toBe(ownerMember.userId);
    expect(body.user.role).toBe("owner");
    expect(body.user.organizationId).toBe(organization.id);
  });

  it("rejects login with unknown email or unknown organization", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: {
        organizationId: "org_non_existent",
        email: "nobody@example.com",
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it("authenticates and decodes user profile on GET /api/v1/auth/me", async () => {
    const orgRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Profile Test Corp",
        ownerEmail: "lead@profile.com",
        ownerName: "Lead",
      },
    });
    const { organization } = JSON.parse(orgRes.body);

    const tokenRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: {
        organizationId: organization.id,
        email: "lead@profile.com",
      },
    });
    const { token } = JSON.parse(tokenRes.body);

    // Authorized request
    const meRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(meRes.statusCode).toBe(200);
    const meBody = JSON.parse(meRes.body);
    expect(meBody.user.email).toBe("lead@profile.com");
    expect(meBody.user.role).toBe("owner");
    expect(meBody.user.organizationId).toBe(organization.id);
  });

  it("rejects unauthenticated requests or tampered signatures", async () => {
    // 1. Missing header
    const noHeaderRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
    });
    expect(noHeaderRes.statusCode).toBe(401);

    // 2. Tampered signature
    const tamperedRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.tampered_invalid_sig",
      },
    });
    expect(tamperedRes.statusCode).toBe(401);
  });

  it("enforces role-based access control (RBAC) on candidate token issuance", async () => {
    const orgRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "RBAC Test Corp",
        ownerEmail: "admin@rbac.com",
        ownerName: "Admin User",
      },
    });
    const { organization } = JSON.parse(orgRes.body);

    // Add a Reviewer member to the organization
    const reviewerRes = await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${organization.id}/members`,
      payload: {
        name: "Reviewer User",
        email: "reviewer@rbac.com",
        role: "reviewer",
      },
    });
    expect(reviewerRes.statusCode).toBe(201);

    // 1. Get tokens for Admin vs Reviewer
    const adminTokenRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: organization.id, email: "admin@rbac.com" },
    });
    const { token: adminToken } = JSON.parse(adminTokenRes.body);

    const reviewerTokenRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: organization.id, email: "reviewer@rbac.com" },
    });
    const { token: reviewerToken } = JSON.parse(reviewerTokenRes.body);

    // 2. Admin CAN issue candidate token (201)
    const adminCandidateRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/candidate-token",
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        organizationId: organization.id,
        sessionId: "sess_cand_101",
        candidateId: "cand_101",
        candidateEmail: "candidate101@example.com",
      },
    });
    expect(adminCandidateRes.statusCode).toBe(201);
    const candidateAuth = JSON.parse(adminCandidateRes.body);
    expect(candidateAuth.user.role).toBe("candidate");
    expect(candidateAuth.user.sessionId).toBe("sess_cand_101");

    // 3. Reviewer CANNOT issue candidate token (403 Forbidden)
    const reviewerCandidateRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/candidate-token",
      headers: { Authorization: `Bearer ${reviewerToken}` },
      payload: {
        organizationId: organization.id,
        sessionId: "sess_cand_102",
        candidateId: "cand_102",
      },
    });
    expect(reviewerCandidateRes.statusCode).toBe(403);
    const errBody = JSON.parse(reviewerCandidateRes.body);
    expect(errBody.error).toBe("FORBIDDEN");
  });

  it("enforces tenant boundary isolation: prevents issuing candidate tokens for another org", async () => {
    // Org A
    const orgARes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: { name: "Org Alpha", ownerEmail: "owner@alpha.com", ownerName: "Alpha" },
    });
    const { organization: orgA } = JSON.parse(orgARes.body);

    // Org B
    const orgBRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: { name: "Org Beta", ownerEmail: "owner@beta.com", ownerName: "Beta" },
    });
    const { organization: orgB } = JSON.parse(orgBRes.body);

    // Login as Org A owner
    const tokenRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: orgA.id, email: "owner@alpha.com" },
    });
    const { token: orgAToken } = JSON.parse(tokenRes.body);

    // Org A owner attempts to issue token for Org B (IDOR attack)
    expect(() => {
      const decoded = authService.verifyToken(orgAToken);
      authService.assertTenantAccess(decoded, orgB.id);
    }).toThrow("Cross-tenant access forbidden");
  });

  it("enforces candidate session isolation: candidate cannot access another candidate's session", () => {
    const candidateContext = {
      userId: "cand_1",
      organizationId: "org_1",
      sessionId: "sess_1",
      role: "candidate" as const,
    };

    // Access own session -> passes
    expect(() => authService.assertSessionAccess(candidateContext, "sess_1")).not.toThrow();

    // Access other session -> throws AuthorizationError
    expect(() => authService.assertSessionAccess(candidateContext, "sess_2")).toThrow(
      "strictly restricted to session 'sess_1'"
    );
  });
});
