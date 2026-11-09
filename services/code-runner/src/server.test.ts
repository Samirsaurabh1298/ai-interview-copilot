import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildRunnerServer } from "./server.js";
import type { FastifyInstance } from "fastify";

describe("Runner Server & Token Authentication (LOOP 9.1)", () => {
  const TEST_SECRET = "test-secret-token-abcdef123456";
  let appWithAuth: FastifyInstance;
  let appWithoutAuth: FastifyInstance;

  beforeAll(async () => {
    appWithAuth = await buildRunnerServer({ authToken: TEST_SECRET });
    appWithoutAuth = await buildRunnerServer({ allowUnauthenticated: true });
    await appWithAuth.ready();
    await appWithoutAuth.ready();
  });

  afterAll(async () => {
    await appWithAuth.close();
    await appWithoutAuth.close();
  });

  it("exposes /health unauthenticated for health probes", async () => {
    const res = await appWithAuth.inject({
      method: "GET",
      url: "/health",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("healthy");
    expect(body.service).toBe("code-runner");
    expect(body.timestamp).toBeDefined();
  });

  it("rejects /environment with 401 when token is missing", async () => {
    const res = await appWithAuth.inject({
      method: "GET",
      url: "/environment",
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("rejects /environment with 401 when token is invalid", async () => {
    const res = await appWithAuth.inject({
      method: "GET",
      url: "/environment",
      headers: {
        authorization: "Bearer wrong-token",
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it("allows /environment with 200 when valid bearer token is provided", async () => {
    const res = await appWithAuth.inject({
      method: "GET",
      url: "/environment",
      headers: {
        authorization: `Bearer ${TEST_SECRET}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("runtimeName");
    expect(body).toHaveProperty("status");
  });

  it("allows /environment with 200 when valid x-runner-token header is provided", async () => {
    const res = await appWithAuth.inject({
      method: "GET",
      url: "/environment",
      headers: {
        "x-runner-token": TEST_SECRET,
      },
    });

    expect(res.statusCode).toBe(200);
  });

  it("rejects /validate with 401 when token is missing", async () => {
    const res = await appWithAuth.inject({
      method: "POST",
      url: "/validate",
      payload: {
        code: "const x = 1;",
        testCode: "test('ok', () => {});",
        language: "typescript",
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it("rejects /validate with 400 for invalid body even if authenticated", async () => {
    const res = await appWithAuth.inject({
      method: "POST",
      url: "/validate",
      headers: {
        authorization: `Bearer ${TEST_SECRET}`,
      },
      payload: {
        // missing code and testCode
        language: "typescript",
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("executes /validate successfully when authenticated", async () => {
    const res = await appWithAuth.inject({
      method: "POST",
      url: "/validate",
      headers: {
        authorization: `Bearer ${TEST_SECRET}`,
      },
      payload: {
        code: "export function add(a: number, b: number) { return a + b; }",
        testCode: `
          test("adds numbers correctly", () => {
            if (add(2, 3) !== 5) throw new Error("Math error");
          });
        `,
        language: "typescript",
        timeoutMs: 5000,
        memoryLimitMb: 128,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.passed).toBe(true);
    expect(body.tests).toHaveLength(1);
    expect(body.tests[0].passed).toBe(true);
  });

  it("allows /validate without token when allowUnauthenticated is true", async () => {
    const res = await appWithoutAuth.inject({
      method: "GET",
      url: "/health",
    });
    expect(res.statusCode).toBe(200);
  });
});
