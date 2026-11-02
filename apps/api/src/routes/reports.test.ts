import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import type {
  Organization,
  AssessmentSession,
  AssessmentTemplate,
  HiringDecisionReport,
  ReviewerDimensionScore,
} from "@ai-copilot/contracts";

describe("Evidence-Linked Hiring Decision Reports Routes (Task 17)", () => {
  let app: FastifyInstance;
  let testOrg: Organization;
  let testTemplate: AssessmentTemplate;
  let testSession: AssessmentSession;
  let adminToken: string;
  let reviewerToken: string;

  const validScores: ReviewerDimensionScore[] = [
    { dimensionId: "code-comprehension", name: "Code Comprehension", rating: 4, rationale: "Precise AST bug localization." },
    { dimensionId: "problem-framing", name: "Problem Framing", rating: 3, rationale: "Solid architectural understanding." },
    { dimensionId: "ai-collaboration", name: "AI Collaboration", rating: 4, rationale: "Prompt formulations were highly structured." },
    { dimensionId: "critical-evaluation", name: "Critical Evaluation", rating: 3, rationale: "Scrutinized patch before applying." },
    { dimensionId: "debugging-implementation", name: "Debugging", rating: 4, rationale: "Zero regressions introduced." },
    { dimensionId: "testing-verification", name: "Testing", rating: 4, rationale: "Verified edge cases in sandbox." },
    { dimensionId: "explanation-judgment", name: "Explanation", rating: 3, rationale: "Clear explanation with production considerations." },
  ];

  beforeAll(async () => {
    app = await buildApp({
      PORT: 4011,
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      DEFAULT_AI_PROVIDER: "mock",
      JWT_SECRET: "test-reports-secret-key-at-least-32-chars-long",
    });
    await app.ready();

    // 1. Create Organization
    const orgRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Acme Reports Corp",
        ownerEmail: "owner@reports.corp",
        ownerName: "Reports Owner",
      },
    });
    testOrg = orgRes.json().organization;

    // 2. Invite Admin & Reviewer
    await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${testOrg.id}/members`,
      payload: { name: "Reviewer Dave", email: "dave@reports.corp", role: "reviewer" },
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${testOrg.id}/members`,
      payload: { name: "Admin Eve", email: "eve@reports.corp", role: "admin" },
    });

    // 3. Tokens
    const adminTokenRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: testOrg.id, email: "eve@reports.corp" },
    });
    adminToken = adminTokenRes.json().token;

    const reviewerTokenRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: testOrg.id, email: "dave@reports.corp" },
    });
    reviewerToken = reviewerTokenRes.json().token;

    // 4. Create Template
    const templateRes = await app.inject({
      method: "POST",
      url: "/api/v1/templates",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        organizationId: testOrg.id,
        title: "Distributed Ticket Queue Bug Challenge",
        slug: "ticket-queue-challenge",
        targetRole: "Principal Frontend Engineer",
        difficulty: "senior",
        language: "typescript",
        durationMinutes: 60,
        defaultAiBudgetUsd: 0.25,
        description: "Fix priority inversion in queue.",
        starterCode: "export function solve() { return false; }",
        verificationTestCode: "describe('queue', () => { it('sorts', () => {}); });",
      },
    });
    testTemplate = templateRes.json();

    // 5. Create Session
    const sessionRes = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        templateId: testTemplate.id,
        organizationId: testOrg.id,
        candidateName: "Alex Mercer",
        candidateEmail: "alex@mercer.dev",
      },
    });
    testSession = sessionRes.json();

    // 6. Generate Candidate Token
    const candTokenRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/candidate-token",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        organizationId: testOrg.id,
        sessionId: testSession.id,
        candidateId: "Alex Mercer",
        candidateEmail: "alex@mercer.dev",
        validitySeconds: 3600,
      },
    });
    const candidateToken = candTokenRes.json().token;

    // 7. Submit Final Solution for Session
    await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${testSession.id}/submit`,
      headers: { authorization: `Bearer ${candidateToken}` },
      payload: {
        finalCode: "export function solve() { return true; }",
        technicalExplanation: "Fixed priority inversion by replacing stable sort comparison operator.",
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 404 when generating report for non-existent session", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/sessions/non_existent_session_id/report",
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("NOT_FOUND");
  });

  it("generates evidence-linked hiring decision report with tamper verification seal", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${testSession.id}/report`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    if (res.statusCode !== 200) {
      console.error("FAIL REPORT RES:", res.statusCode, res.body);
    }
    expect(res.statusCode).toBe(200);
    const report = res.json() as HiringDecisionReport;

    expect(report.sessionId).toBe(testSession.id);
    expect(report.candidateName).toBe("Alex Mercer");
    expect(report.templateTitle).toBe(testTemplate.title);
    expect(report.targetRole).toBe("Principal Frontend Engineer");
    expect(report.difficulty).toBe("senior");
    expect(report.dimensions.length).toBe(7);

    // Verify all 7 dimensions carry evidence citations and weighted scores
    for (const dim of report.dimensions) {
      expect(dim.calibratedRating).toBeGreaterThanOrEqual(1);
      expect(dim.calibratedRating).toBeLessThanOrEqual(4);
      expect(dim.weightedScoreContribution).toBeGreaterThan(0);
      expect(dim.evidenceCitations.length).toBeGreaterThan(0);
    }

    // Verify Cryptographic Tamper-Evident Seal
    expect(report.verificationSeal).toBeDefined();
    expect(report.verificationSeal.submissionFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(report.verificationSeal.reportSignature).toMatch(/^[a-f0-9]{64}$/);
    expect(report.verificationSeal.tamperCheckStatus).toBe("verified");
  });

  it("updates report with committee signoffs after reviewers submit rubric evaluations", async () => {
    // Reviewer Dave submits evaluation
    const evalRes1 = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${testSession.id}/evaluations`,
      headers: { authorization: `Bearer ${reviewerToken}` },
      payload: {
        scores: validScores,
        recommendation: "strong_hire",
        summaryRationale: "Exemplary solution with comprehensive defensive checks and zero regressions.",
      },
    });
    expect(evalRes1.statusCode).toBe(201);

    // Admin Eve submits evaluation
    const evalRes2 = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${testSession.id}/evaluations`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        scores: validScores,
        recommendation: "strong_hire",
        summaryRationale: "Confirmed clean architecture and optimal complexity.",
      },
    });
    expect(evalRes2.statusCode).toBe(201);

    // Fetch refreshed report
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${testSession.id}/report`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const report = res.json() as HiringDecisionReport;

    expect(report.calibrationStatus).toBe("calibrated");
    expect(report.consensusRecommendation).toBe("strong_hire");
    expect(report.committeeSignoffs.length).toBe(2);
    expect(report.calibratedCompositeScore).toBeGreaterThanOrEqual(85);
  });

  it("exports standalone print-ready HTML hiring report", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${testSession.id}/report/export?token=${adminToken}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    const html = res.body;

    expect(html).toContain("Candidate Hiring Decision Report");
    expect(html).toContain("Alex Mercer");
    expect(html).toContain("Distributed Ticket Queue Bug Challenge");
    expect(html).toContain("Cryptographic Tamper-Evident Verification Seal");
    expect(html).toContain("Print / Export PDF");
    expect(html).toContain("7-Dimension Rubric Evaluation & Evidence Citations");
  });
});
