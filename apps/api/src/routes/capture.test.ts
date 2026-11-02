import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../app.js";
import type { FastifyInstance } from "fastify";
import { executeCodeInSandbox } from "@ai-copilot/code-runner";

describe("Screen Capture & Multimodal OCR Ingest Routes (Task 22)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({
      JWT_SECRET: "super-secure-production-grade-jwt-secret-key-32-bytes",
      ENABLE_BUILTIN_SANDBOX: false,
    });
  });

  it("rejects invalid request with missing imageBase64", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/capture/extract-question",
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toContain("Invalid screen capture request payload");
  });

  it("extracts LRU Cache challenge from screenshot with user hint", async () => {
    const dummyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/capture/extract-question",
      payload: {
        imageBase64: dummyPngBase64,
        mimeType: "image/png",
        userHint: "LeetCode 146: LRU Cache with O(1) operations",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.title).toContain("LRU Cache");
    expect(body.track).toBe("backend");
    expect(body.difficulty).toBe("senior");
    expect(body.starterCode).toContain("class LRUCache");
    expect(body.testCases.length).toBeGreaterThanOrEqual(2);
    expect(body.testHarnessCode).toContain("LRUCache");
    expect(body.confidenceScore).toBeGreaterThanOrEqual(0.9);
  });

  it("extracts Two Sum challenge when user hint mentions two sum", async () => {
    const dummyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/capture/extract-question",
      payload: {
        imageBase64: `data:image/png;base64,${dummyPngBase64}`,
        userHint: "LeetCode 1: Two Sum with array and target",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.title).toContain("Two Sum");
    expect(body.track).toBe("algorithms");
    expect(body.difficulty).toBe("junior");
    expect(body.starterCode).toContain("function twoSum");
  });

  it("extracts default Token Bucket Rate Limiter for general system design screenshot", async () => {
    const dummyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/capture/extract-question",
      payload: {
        imageBase64: dummyPngBase64,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.title).toContain("Token Bucket Rate Limiter");
    expect(body.track).toBe("systems");
    expect(body.difficulty).toBe("senior");
    expect(body.hints.length).toBe(3);
  });

  it("rejects excessively large payloads over 15MB to prevent memory exhaustion", async () => {
    const largePayload = "A".repeat(16 * 1024 * 1024);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/capture/extract-question",
      payload: {
        imageBase64: largePayload,
      },
    });

    expect([413, 500]).toContain(res.statusCode);
  });

  it("returns sample presets for immediate 1-click OCR demonstration", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/capture/sample-presets",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(3);
    expect(body.presets[0].name).toContain("LRU Cache");
    expect(body.presets[1].name).toContain("Two Sum");
    expect(body.presets[2].name).toContain("Rate Limiter");
  });

  it("executes the extracted starter code against extracted test harness in sandbox", async () => {
    const dummyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/capture/extract-question",
      payload: {
        imageBase64: dummyPngBase64,
        userHint: "Two sum",
      },
    });

    const body = res.json();
    const runResult = await executeCodeInSandbox({
      language: "typescript",
      code: body.starterCode,
      testCode: body.testHarnessCode,
      timeoutMs: 5000,
      memoryLimitMb: 64,
    });

    expect(runResult.passed).toBe(true);
    expect(runResult.tests.length).toBeGreaterThanOrEqual(2);
    expect(runResult.tests.every((t) => t.passed)).toBe(true);
  });
});

