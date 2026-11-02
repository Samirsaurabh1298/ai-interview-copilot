import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

describe("Candidate Practice Studio Routes (Task 21)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({
      PORT: 0,
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      CORS_ORIGIN: "*",
      LOG_LEVEL: "silent",
      ANTHROPIC_API_KEY: undefined,
      GOOGLE_GENERATIVE_AI_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
      GROQ_API_KEY: undefined,
      JWT_SECRET: "super-secure-production-grade-jwt-secret-key-32-bytes",
      DEFAULT_AI_PROVIDER: "mock",
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/practice/challenges returns curated challenge catalog", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/practice/challenges",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(body.challenges)).toBe(true);

    const first = body.challenges[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("title");
    expect(first).toHaveProperty("track");
    expect(first).toHaveProperty("difficulty");
    expect(first).toHaveProperty("starterCode");
    expect(first).toHaveProperty("verificationTestCode");
  });

  it("GET /api/v1/practice/challenges filters by track and difficulty", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/practice/challenges?track=frontend&difficulty=mid",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.challenges.length).toBeGreaterThanOrEqual(1);
    for (const c of body.challenges) {
      expect(c.track).toBe("frontend");
      expect(c.difficulty).toBe("mid");
    }
  });

  it("GET /api/v1/practice/challenges/:id returns specific challenge", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/practice/challenges/chal_frontend_ticket_queue",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.challenge.id).toBe("chal_frontend_ticket_queue");
    expect(body.challenge.slug).toBe("react-immutable-ticket-queue");
    expect(body.challenge.hints.length).toBeGreaterThan(0);
  });

  it("GET /api/v1/practice/challenges/:id returns 404 for unknown challenge", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/practice/challenges/non_existent_challenge_999",
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("NOT_FOUND");
  });

  it("POST /api/v1/practice/evaluate generates comprehensive diagnostic feedback card for strong submission", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/practice/evaluate",
      payload: {
        challengeId: "chal_frontend_ticket_queue",
        candidateCode: `export function sortTickets(tickets) { return [...tickets].sort((a,b) => b.priority.localeCompare(a.priority) || a.createdAt - b.createdAt); }`,
        technicalExplanation: "Enforced strict array immutability with shallow copy spread operator. Added deterministic secondary timestamp sorting on priority collisions. Time complexity is O(N log N) and space complexity is O(N).",
        elapsedSeconds: 1500, // 25 mins
        aiQueriesCount: 3,
        aiBudgetConsumedUsd: 0.08,
        patchesAccepted: 2,
        patchesRejected: 1, // demonstrates critical thinking & skepticism!
        testRunsCount: 4,
        testResults: {
          passed: 5,
          total: 5,
          durationMs: 82,
          tests: [
            { name: "sortTickets preserves array immutability", passed: true, durationMs: 14 },
            { name: "sortTickets orders by priority", passed: true, durationMs: 12 },
            { name: "sortTickets applies secondary FIFO sort", passed: true, durationMs: 15 },
            { name: "resolveTicket immutably removes ticket", passed: true, durationMs: 20 },
            { name: "resolveTicket handles non-existent ticket", passed: true, durationMs: 21 },
          ],
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("feedback");
    const fb = body.feedback;

    expect(fb.challengeId).toBe("chal_frontend_ticket_queue");
    expect(fb.dimensions).toHaveLength(7);
    expect(fb.compositeScore).toBeGreaterThanOrEqual(80);
    expect(["strong_hire", "hire"]).toContain(fb.recommendation);
    expect(fb.aiRelianceIndex.label).toBe("Critical & Methodical Reviewer");
    expect(fb.speedAndPrecision.testPassRatePercent).toBe(100);
    expect(fb.actionableTakeaways.length).toBeGreaterThan(0);
  });

  it("POST /api/v1/practice/evaluate handles failing tests and over-reliance gracefully", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/practice/evaluate",
      payload: {
        challengeId: "chal_frontend_ticket_queue",
        candidateCode: `export function sortTickets(tickets) { return tickets; }`,
        technicalExplanation: "Tried sorting tickets.",
        elapsedSeconds: 2400,
        aiQueriesCount: 16, // excessive queries
        aiBudgetConsumedUsd: 0.24,
        patchesAccepted: 4,
        patchesRejected: 0, // blind acceptance
        testRunsCount: 1,
        testResults: {
          passed: 1,
          total: 5,
          durationMs: 50,
          tests: [
            { name: "sortTickets preserves array immutability", passed: false, durationMs: 10, error: "Mutation occurred" },
            { name: "sortTickets orders by priority", passed: false, durationMs: 10 },
            { name: "sortTickets applies secondary FIFO sort", passed: false, durationMs: 10 },
            { name: "resolveTicket immutably removes ticket", passed: true, durationMs: 10 },
            { name: "resolveTicket handles non-existent ticket", passed: false, durationMs: 10 },
          ],
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const fb = body.feedback;

    expect(fb.compositeScore).toBeLessThan(70);
    expect(["lean_hire", "no_hire"]).toContain(fb.recommendation);
    expect(fb.aiRelianceIndex.label).toBe("Over-Reliant on Suggestions");
    expect(fb.speedAndPrecision.testPassRatePercent).toBe(20);
  });

  it("POST /api/v1/practice/evaluate rejects invalid payload with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/practice/evaluate",
      payload: {
        challengeId: "chal_frontend_ticket_queue",
        candidateCode: "", // empty code
        technicalExplanation: "short", // under min length
        elapsedSeconds: -50, // invalid negative time
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("VALIDATION_ERROR");
  });
});
