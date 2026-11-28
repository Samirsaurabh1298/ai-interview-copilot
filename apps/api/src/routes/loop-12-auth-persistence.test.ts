import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq, sql } from "drizzle-orm";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { getDb, verifyProductionSchema, type AppDatabase } from "../db/connection.js";
import { organizationMembers, magicLinkTokens } from "../db/schema.js";
import { OrganizationService } from "../services/organization.js";
import { MagicLinkService, MagicLinkError } from "../services/magic-link.js";

describe("LOOP 12.0.1: Persistent Auth, Rate Limiting, JWT Revocation & Production Migration Guard", () => {
  let app: FastifyInstance;
  let db: AppDatabase;
  let orgId: string;
  let ownerEmail: string;
  let ownerToken: string;

  beforeAll(async () => {
    const config = loadConfig();
    config.NODE_ENV = "test";
    config.DEFAULT_AI_PROVIDER = "mock";
    app = await buildApp(config);
    await app.ready();
    db = await getDb();

    ownerEmail = `loop12-owner-${Date.now()}@acme.test`;
    const orgRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Loop 12 Multi-Replica Corp",
        slug: `loop12-corp-${Date.now()}`,
        plan: "enterprise",
        ownerEmail,
        ownerName: "Replica Owner",
      },
    });
    expect(orgRes.statusCode).toBe(201);
    orgId = orgRes.json().organization.id;

    const tokRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: orgId, email: ownerEmail },
    });
    expect(tokRes.statusCode).toBe(200);
    ownerToken = tokRes.json().token;
  });

  afterAll(async () => {
    await app.close();
  });

  it("persists magic-link tokens across service re-instantiation and prevents concurrent replay", async () => {
    const memberEmail = `replica-magic-${Date.now()}@acme.test`;
    const inviteRes = await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${orgId}/members`,
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: {
        email: memberEmail,
        name: "Replica User",
        role: "interviewer",
      },
    });
    expect(inviteRes.statusCode).toBe(201);

    // Instance 1 generates magic link (persisted in SQL)
    const orgSvc1 = new OrganizationService();
    await orgSvc1.loadFromDatabase();
    const magicSvc1 = new MagicLinkService(orgSvc1);

    const reqRes = await magicSvc1.requestMagicLink(memberEmail, orgId);
    expect(reqRes.success).toBe(true);
    expect(reqRes.debugToken).toBeDefined();
    const rawToken = reqRes.debugToken!;

    // Instance 2 (fresh object / separate replica) verifies concurrently 3x
    const orgSvc2 = new OrganizationService();
    await orgSvc2.loadFromDatabase();
    const magicSvc2 = new MagicLinkService(orgSvc2);

    const raceResults = await Promise.allSettled([
      magicSvc2.verifyAndConsumeToken(rawToken),
      magicSvc2.verifyAndConsumeToken(rawToken),
      magicSvc2.verifyAndConsumeToken(rawToken),
    ]);

    const fulfilled = raceResults.filter((r) => r.status === "fulfilled");
    const rejected = raceResults.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(2);
    for (const rej of rejected) {
      if (rej.status === "rejected") {
        expect(rej.reason).toBeInstanceOf(MagicLinkError);
        expect((rej.reason as MagicLinkError).code).toBe("TOKEN_ALREADY_USED");
      }
    }

    // Expired token persisted in DB is also rejected with TOKEN_EXPIRED
    const expiredReq = await magicSvc1.requestMagicLink(memberEmail, orgId);
    const expiredRaw = expiredReq.debugToken!;
    await db
      .update(magicLinkTokens)
      .set({ expiresAt: sql`clock_timestamp() - interval '2 minutes'` })
      .where(eq(magicLinkTokens.email, memberEmail));

    await expect(magicSvc2.verifyAndConsumeToken(expiredRaw)).rejects.toMatchObject({
      code: "TOKEN_EXPIRED",
    });
  });

  it("persists auth rate-limit windows across service re-instantiation and rejects 6th request with 429", async () => {
    const rateEmail = `persistent-rl-${Date.now()}@acme.test`;
    await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${orgId}/members`,
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: {
        email: rateEmail,
        name: "Rate Limit Member",
        role: "reviewer",
      },
    });

    // 3 requests on Replica A
    const orgSvcA = new OrganizationService();
    await orgSvcA.loadFromDatabase();
    const magicSvcA = new MagicLinkService(orgSvcA);
    for (let i = 0; i < 3; i++) {
      const res = await magicSvcA.requestMagicLink(rateEmail, orgId);
      expect(res.success).toBe(true);
    }

    // 2 requests on Replica B (fresh service instance sharing PostgreSQL/PGlite)
    const orgSvcB = new OrganizationService();
    await orgSvcB.loadFromDatabase();
    const magicSvcB = new MagicLinkService(orgSvcB);
    for (let i = 0; i < 2; i++) {
      const res = await magicSvcB.requestMagicLink(rateEmail, orgId);
      expect(res.success).toBe(true);
    }

    // 6th request over HTTP route triggers persistent 429 RATE_LIMIT_EXCEEDED
    const blockedHttp = await app.inject({
      method: "POST",
      url: "/api/v1/auth/magic-link/request",
      payload: { email: rateEmail, organizationId: orgId },
    });
    expect(blockedHttp.statusCode).toBe(429);
    expect(blockedHttp.json().error).toBe("RATE_LIMIT_EXCEEDED");
  });

  it("immediately revokes JWTs across routes after POST /api/v1/auth/logout via DB token_version", async () => {
    const logoutEmail = `logout-rev-${Date.now()}@acme.test`;
    const inv = await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${orgId}/members`,
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: {
        email: logoutEmail,
        name: "Logout Test User",
        role: "admin",
      },
    });
    expect(inv.statusCode).toBe(201);

    const linkRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/magic-link/request",
      payload: { email: logoutEmail, organizationId: orgId },
    });
    const magicToken = linkRes.json().debugToken;

    const verifyRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/magic-link/verify",
      payload: { token: magicToken },
    });
    expect(verifyRes.statusCode).toBe(200);
    const jwt1 = verifyRes.json().token as string;
    expect(verifyRes.json().user.tokenVersion).toBe(1);

    // Valid before logout
    const meBefore = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { Authorization: `Bearer ${jwt1}` },
    });
    expect(meBefore.statusCode).toBe(200);

    // Logout increments token_version atomically
    const logoutRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { Authorization: `Bearer ${jwt1}` },
    });
    expect(logoutRes.statusCode).toBe(200);

    // Old JWT is immediately rejected on BOTH requireAuth routes AND preHandler-protected org routes
    const meAfter = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { Authorization: `Bearer ${jwt1}` },
    });
    expect(meAfter.statusCode).toBe(401);
    expect(meAfter.json().error).toBe("TOKEN_REVOKED");

    const tmplAfter = await app.inject({
      method: "GET",
      url: `/api/v1/templates?organizationId=${orgId}`,
      headers: { Authorization: `Bearer ${jwt1}` },
    });
    expect(tmplAfter.statusCode).toBe(401);
    expect(tmplAfter.json().error).toBe("TOKEN_REVOKED");

    // Re-login mints fresh JWT with incremented tokenVersion: 2
    const reloginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: orgId, email: logoutEmail },
    });
    expect(reloginRes.statusCode).toBe(200);
    expect(reloginRes.json().user.tokenVersion).toBe(2);
    const jwt2 = reloginRes.json().token as string;

    const meNew = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { Authorization: `Bearer ${jwt2}` },
    });
    expect(meNew.statusCode).toBe(200);
  });

  it("increments token_version and revokes JWTs on member role demotion and member removal", async () => {
    const adminEmail = `demote-${Date.now()}@acme.test`;
    const mRes = await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${orgId}/members`,
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: { email: adminEmail, name: "Demoted Admin", role: "admin" },
    });
    const memberId = mRes.json().id as string;

    const tokRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: orgId, email: adminEmail },
    });
    const staleAdminJwt = tokRes.json().token as string;

    // Demote admin -> reviewer
    const demoteRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/organizations/${orgId}/members/${memberId}`,
      headers: { Authorization: `Bearer ${ownerToken}` },
      payload: { role: "reviewer" },
    });
    expect(demoteRes.statusCode).toBe(200);
    expect(demoteRes.json().role).toBe("reviewer");

    // Stale admin JWT must be rejected immediately
    const postDemoteMe = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { Authorization: `Bearer ${staleAdminJwt}` },
    });
    expect(postDemoteMe.statusCode).toBe(401);
    expect(postDemoteMe.json().error).toBe("TOKEN_REVOKED");

    // Re-issue token as reviewer, then remove member -> also increments token_version and revokes
    const freshTokRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: orgId, email: adminEmail },
    });
    const reviewerJwt = freshTokRes.json().token as string;
    expect(freshTokRes.json().user.tokenVersion).toBe(2);

    const delRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/organizations/${orgId}/members/${memberId}`,
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(delRes.statusCode).toBe(204);

    const [row] = await db
      .select({ status: organizationMembers.status, tokenVersion: organizationMembers.tokenVersion })
      .from(organizationMembers)
      .where(eq(organizationMembers.id, memberId))
      .limit(1);
    expect(row?.status).toBe("removed");
    expect(row?.tokenVersion).toBe(3);

    const postRemoveMe = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { Authorization: `Bearer ${reviewerJwt}` },
    });
    expect(postRemoveMe.statusCode).toBe(401);
    expect(postRemoveMe.json().error).toBe("TOKEN_REVOKED");
  });

  it("verifyProductionSchema fails fast with actionable migration error when tables/columns are missing", async () => {
    const incompleteDb = {
      execute: async () => ({
        rows: [{ table_name: "organizations" }, { table_name: "organization_members" }],
      }),
    } as unknown as AppDatabase;

    await expect(verifyProductionSchema(incompleteDb)).rejects.toThrow(
      /Database schema migrations have not been applied/i
    );
  });
});
