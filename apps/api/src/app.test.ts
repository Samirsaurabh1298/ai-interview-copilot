import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

describe("API Integration Tests", () => {
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

  it("returns healthy on GET /health", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("healthy");
  });

  it("lists providers on GET /api/v1/providers", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/providers",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.providers.length).toBeGreaterThan(0);
    expect(body.defaultProvider).toBeDefined();
  });

  it("generates a structured answer on POST /api/v1/answers/generate", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/answers/generate",
      payload: {
        task: "debug",
        question: "Off-by-one error in binary search loop",
        code: "while (low <= high) { ... }",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.category).toBe("debugging");
    expect(body.diagnosis).toBeDefined();
    expect(body.approach).toBeDefined();
    expect(body.explanation).toBeDefined();
    expect(body.confidence).toBeGreaterThan(0);
  });

  it("returns 400 when invalid payload is passed to /api/v1/answers/generate", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/answers/generate",
      payload: {
        task: "unsupported-task-type",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("Validation failed");
  });

  it("retrieves assessment policy on GET /api/v1/assessment/policy", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/assessment/policy",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.maxBudgetUsd).toBe(0.25);
    expect(body.warningThresholdPercent).toBe(80);
    expect(body.timeLimitSeconds).toBe(3600);
  });

  it("evaluates candidate submission on POST /api/v1/assessment/evaluate", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/assessment/evaluate",
      payload: {
        sessionId: "sess_integration_test",
        candidateId: "cand_test_42",
        finalCode: "export const solve = () => 42;",
        diff: "--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,1 +1,1 @@\n- return 0;\n+ return 42;",
        explanation: "Identified the hardcoded zero root cause and substituted the computed solution cleanly.",
        testResults: [
          { name: "test-1", passed: true, durationMs: 10 },
          { name: "test-2", passed: true, durationMs: 15 },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.sessionId).toBe("sess_integration_test");
    expect(body.scoringMethod).toBe("ai_draft");
    expect(body.weightedTotalScore).toBeGreaterThanOrEqual(80);
    expect(body.dimensions).toHaveLength(7);
  });

  it("enforces concurrent budget quota: prevents race conditions from exceeding budget limit", async () => {
    const sessionId = "sess_concurrent_test_" + Date.now();
    // Initialize session with budget that allows 1 query reservation but rejects concurrent attempts ($0.025 USD)
    const initRes = await app.inject({
      method: "POST",
      url: "/api/v1/assessment/session",
      payload: {
        sessionId,
        policy: {
          maxBudgetUsd: 0.025,
          warningThresholdPercent: 80,
          timeLimitSeconds: 3600,
        },
      },
    });
    expect(initRes.statusCode).toBe(201);

    // Dispatch 8 simultaneous requests against this session
    const concurrentRequests = Array.from({ length: 8 }).map(() =>
      app.inject({
        method: "POST",
        url: `/api/v1/answers/generate?sessionId=${sessionId}&model=gpt-4o`,
        payload: {
          task: "debug",
          question: "Concurrent test query",
          code: "const x = 1;",
        },
      })
    );

    const responses = await Promise.all(concurrentRequests);
    const statusCodes = responses.map((r) => r.statusCode);

    // Requests within budget succeed (200), and concurrent requests exceeding budget are locked out with 429
    const succeeded = responses.filter((r) => r.statusCode === 200);
    const quotaExhausted = responses.filter((r) => r.statusCode === 429);

    expect(succeeded.length).toBeGreaterThanOrEqual(1);
    expect(quotaExhausted.length).toBeGreaterThanOrEqual(1);
    expect(succeeded.length + quotaExhausted.length).toBe(8);

    const errorBody = JSON.parse(quotaExhausted[0]?.body ?? "{}");
    expect(errorBody.error).toBe("QUOTA_EXHAUSTED");

    // Verify budget ledger strictly respected the $0.025 limit with zero budget overrun
    const budgetRes = await app.inject({
      method: "GET",
      url: `/api/v1/assessment/budget/${sessionId}`,
    });
    expect(budgetRes.statusCode).toBe(200);
    const budget = JSON.parse(budgetRes.body);
    expect(budget.consumedBudgetUsd).toBeLessThanOrEqual(0.025);
    expect(budget.consumedBudgetUsd).toBeGreaterThan(0);
  });

  it("enforces session expiration integrity: rejects AI requests when session time limit has elapsed", async () => {
    const sessionId = "sess_expired_test_" + Date.now();
    // Initialize session with a 1-second limit created 5 seconds ago
    const pastDate = new Date(Date.now() - 5000).toISOString();
    const initRes = await app.inject({
      method: "POST",
      url: "/api/v1/assessment/session",
      payload: {
        sessionId,
        policy: {
          maxBudgetUsd: 0.25,
          timeLimitSeconds: 1,
        },
        createdAt: pastDate,
      },
    });
    expect(initRes.statusCode).toBe(201);

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/answers/generate?sessionId=${sessionId}`,
      payload: {
        task: "debug",
        question: "Expired session query",
        code: "const y = 2;",
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("SESSION_EXPIRED");
    expect(body.message).toContain("time limit");
  });

  it("releases budget reservation when AI provider call fails without penalizing candidate", async () => {
    const sessionId = "sess_release_test_" + Date.now();
    await app.inject({
      method: "POST",
      url: "/api/v1/assessment/session",
      payload: {
        sessionId,
        policy: {
          maxBudgetUsd: 0.05,
        },
      },
    });

    // Request with non-existent provider to trigger error
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/answers/generate?sessionId=${sessionId}&provider=non_existent_provider`,
      payload: {
        task: "debug",
        question: "Will fail",
        code: "const z = 3;",
      },
    });

    expect(res.statusCode).toBe(502);

    // Verify reservation was cleanly released and candidate consumed spend remains $0.00
    const budgetRes = await app.inject({
      method: "GET",
      url: `/api/v1/assessment/budget/${sessionId}`,
    });
    const budget = JSON.parse(budgetRes.body);
    expect(budget.consumedBudgetUsd).toBe(0);
    expect(budget.remainingBudgetUsd).toBe(0.05);
    expect(budget.isExhausted).toBe(false);
  });
});

