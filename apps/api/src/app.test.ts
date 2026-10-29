import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

describe("API Integration Tests", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const config = loadConfig();
    config.NODE_ENV = "test";
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
});

