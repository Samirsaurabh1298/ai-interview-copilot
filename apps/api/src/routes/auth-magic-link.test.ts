import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";

describe("LOOP 10: Production Magic Link Authentication & Runner Security Gate", () => {
  let app: FastifyInstance;
  let testOrgId: string;

  beforeAll(async () => {
    const config = loadConfig();
    config.NODE_ENV = "test";
    app = await buildApp(config);
    await app.ready();

    // Create test organization
    const orgRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Acme Pilot Corp",
        slug: "acme-pilot-" + Date.now(),
        plan: "pilot",
        ownerEmail: "pilot-admin@acmepilot.com",
        ownerName: "Sarah Connor",
      },
    });
    expect(orgRes.statusCode).toBe(201);
    testOrgId = orgRes.json().organization.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Single-Use Magic Link Authentication (Phase 1)", () => {
    it("provides anti-enumeration protection: returns success even if email does not exist", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/magic-link/request",
        payload: {
          email: "unknown-hacker@nowhere.com",
          organizationId: testOrgId,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain("If an active member account matches this email");
      expect(body.debugToken).toBeUndefined(); // Never generates or exposes token for unknown users
    });

    it("issues a single-use login token for an active organization member", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/magic-link/request",
        payload: {
          email: "pilot-admin@acmepilot.com",
          organizationId: testOrgId,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.debugToken).toBeDefined();
      expect(typeof body.debugToken).toBe("string");
      expect(body.debugToken.length).toBe(64); // 32 bytes hex
    });

    it("rejects invalid or tampered login tokens with 401", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/magic-link/verify",
        payload: {
          token: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
        },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.error).toBe("INVALID_OR_EXPIRED_TOKEN");
    });

    it("successfully verifies valid magic token and burns it on consumption (single-use)", async () => {
      // 1. Request token
      const reqRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/magic-link/request",
        payload: {
          email: "pilot-admin@acmepilot.com",
          organizationId: testOrgId,
        },
      });
      const token = reqRes.json().debugToken;
      expect(token).toBeDefined();

      // 2. Verify token
      const verifyRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/magic-link/verify",
        payload: { token },
      });

      expect(verifyRes.statusCode).toBe(200);
      const verifyBody = verifyRes.json();
      expect(verifyBody.token).toBeDefined();
      expect(verifyBody.user.email).toBe("pilot-admin@acmepilot.com");
      expect(verifyBody.user.role).toBe("owner");

      // 3. Replay Attack Prevention: Attempting to verify the exact same token must fail
      const replayRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/magic-link/verify",
        payload: { token },
      });

      expect(replayRes.statusCode).toBe(401);
      expect(replayRes.json().error).toBe("TOKEN_ALREADY_USED");
    });

    it("enforces rate limits on excessive login link requests", async () => {
      const rateLimitEmail = "rate-limit-test@acmepilot.com";

      // Add member to org
      await app.inject({
        method: "POST",
        url: `/api/v1/organizations/${testOrgId}/members`,
        headers: {
          authorization: `Bearer ${(await app.inject({
            method: "POST",
            url: "/api/v1/auth/token",
            payload: { organizationId: testOrgId, email: "pilot-admin@acmepilot.com" },
          })).json().token}`,
        },
        payload: {
          email: rateLimitEmail,
          name: "Test Member",
          role: "interviewer",
        },
      });

      // Request 5 times (allowed)
      for (let i = 0; i < 5; i++) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/auth/magic-link/request",
          payload: { email: rateLimitEmail, organizationId: testOrgId },
        });
        expect(res.statusCode).toBe(200);
      }

      // 6th request must trigger 429
      const blockedRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/magic-link/request",
        payload: { email: rateLimitEmail, organizationId: testOrgId },
      });

      expect(blockedRes.statusCode).toBe(429);
      expect(blockedRes.json().error).toBe("RATE_LIMIT_EXCEEDED");
    });
  });

  describe("Critical Security Gate: RUNNER_EXECUTION_ENABLED (Phase 0 & 3)", () => {
    it("reports execution status cleanly via /api/v1/code/validate/status", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/code/validate/status",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("executionEnabled");
      expect(body).toHaveProperty("runtime");
    });

    it("strictly rejects untrusted candidate execution when security gate is closed (403)", async () => {
      // Build a dedicated app instance with execution disabled
      const lockedConfig = loadConfig();
      lockedConfig.NODE_ENV = "test";
      lockedConfig.RUNNER_EXECUTION_ENABLED = false;

      const lockedApp = await buildApp(lockedConfig);
      await lockedApp.ready();

      const res = await lockedApp.inject({
        method: "POST",
        url: "/api/v1/code/validate",
        payload: {
          code: "function add(a, b) { return a + b; }",
          testCode: "test('add', () => {});",
          language: "typescript",
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.error).toBe("RUNNER_EXECUTION_DISABLED");
      expect(body.canSubmit).toBe(true);
      expect(body.message).toContain("Untrusted candidate code execution is disabled");

      await lockedApp.close();
    });
  });
});

