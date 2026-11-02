import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import type {
  Organization,
  AssessmentSession,
  AssessmentTemplate,
  ReviewerEvaluation,
  CalibrationConsensus,
  AssessmentScorecard,
  ReviewerDimensionScore,
} from "@ai-copilot/contracts";

describe("Multi-Reviewer Calibration & Consensus Routes (Task 16)", () => {
  let app: FastifyInstance;
  let testOrg: Organization;
  let testTemplate: AssessmentTemplate;
  let testSession: AssessmentSession;
  let reviewerAToken: string;
  let reviewerBToken: string;
  let adminToken: string;

  const validScoresReviewerA: ReviewerDimensionScore[] = [
    { dimensionId: "code-comprehension", name: "Code Comprehension", rating: 4, rationale: "Clean architectural localization." },
    { dimensionId: "problem-framing", name: "Problem Framing", rating: 3, rationale: "Clearly identified ticket requirements." },
    { dimensionId: "ai-collaboration", name: "AI Collaboration", rating: 4, rationale: "Prompt formulations were highly structured." },
    { dimensionId: "critical-evaluation", name: "Critical Evaluation", rating: 3, rationale: "Scrutinized patch before applying." },
    { dimensionId: "debugging-implementation", name: "Debugging", rating: 4, rationale: "Zero regressions introduced." },
    { dimensionId: "testing-verification", name: "Testing", rating: 3, rationale: "Verified edge cases in sandbox." },
    { dimensionId: "explanation-judgment", name: "Explanation", rating: 3, rationale: "Trade-offs well reasoned." },
  ];

  const validScoresReviewerBHighVariance: ReviewerDimensionScore[] = [
    { dimensionId: "code-comprehension", name: "Code Comprehension", rating: 4, rationale: "Agreed on localization." },
    { dimensionId: "problem-framing", name: "Problem Framing", rating: 3, rationale: "Understood scope." },
    { dimensionId: "ai-collaboration", name: "AI Collaboration", rating: 2, rationale: "Over-relied on AI for simple logic." }, // Variance = 2
    { dimensionId: "critical-evaluation", name: "Critical Evaluation", rating: 3, rationale: "Adequate review." },
    { dimensionId: "debugging-implementation", name: "Debugging", rating: 4, rationale: "Sound fix." },
    { dimensionId: "testing-verification", name: "Testing", rating: 3, rationale: "Passed test suite." },
    { dimensionId: "explanation-judgment", name: "Explanation", rating: 3, rationale: "Adequate writeup." },
  ];

  beforeAll(async () => {
    app = await buildApp({
      PORT: 4009,
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      DEFAULT_AI_PROVIDER: "mock",
      JWT_SECRET: "test-calibration-secret-key-at-least-32-chars-long",
    });
    await app.ready();

    // 1. Create Organization
    const orgRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Calibration Testing Corp",
        ownerEmail: "owner@calibration.corp",
        ownerName: "Calibration Owner",
      },
    });
    testOrg = orgRes.json().organization;

    // 2. Invite Reviewer A, Reviewer B, and Admin
    await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${testOrg.id}/members`,
      payload: { name: "Reviewer Alice", email: "alice@calibration.corp", role: "reviewer" },
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${testOrg.id}/members`,
      payload: { name: "Reviewer Bob", email: "bob@calibration.corp", role: "reviewer" },
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${testOrg.id}/members`,
      payload: { name: "Admin Carol", email: "carol@calibration.corp", role: "admin" },
    });

    // 3. Acquire JWT Tokens
    const tokenARes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: testOrg.id, email: "alice@calibration.corp" },
    });
    reviewerAToken = tokenARes.json().token;

    const tokenBRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: testOrg.id, email: "bob@calibration.corp" },
    });
    reviewerBToken = tokenBRes.json().token;

    const tokenCRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/token",
      payload: { organizationId: testOrg.id, email: "carol@calibration.corp" },
    });
    adminToken = tokenCRes.json().token;

    // 4. Create Template
    const templateRes = await app.inject({
      method: "POST",
      url: "/api/v1/templates",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        organizationId: testOrg.id,
        title: "Calibration Assessment Challenge",
        slug: "calibration-challenge",
        targetRole: "Fullstack Engineer",
        difficulty: "mid",
        language: "typescript",
        durationMinutes: 60,
        defaultAiBudgetUsd: 0.25,
        description: "Diagnose and fix queue bug.",
        starterCode: "export function solve() { return false; }",
        verificationTestCode: "describe('test', () => { it('passes', () => {}); });",
      },
    });
    testTemplate = templateRes.json();

    // 5. Create Assessment Session
    const sessionRes = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        organizationId: testOrg.id,
        templateId: testTemplate.id,
        candidateName: "Jordan Candidate",
        candidateEmail: "jordan@candidate.test",
        durationMinutes: 60,
      },
    });
    testSession = sessionRes.json();
  });

  afterAll(async () => {
    await app.close();
  });

  it("enforces Blind Calibration: masks other evaluations until a reviewer submits their own score", async () => {
    // Reviewer A submits their evaluation first
    const submitARes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${testSession.id}/evaluations`,
      headers: { authorization: `Bearer ${reviewerAToken}` },
      payload: {
        scores: validScoresReviewerA,
        recommendation: "hire",
        summaryRationale: "Strong technical execution and sound architecture decisions.",
      },
    });
    expect(submitARes.statusCode).toBe(201);
    const evalA: ReviewerEvaluation = submitARes.json();
    expect(evalA.reviewerName).toBe("Reviewer Alice");
    expect(evalA.weightedTotalScore).toBeGreaterThan(70);

    // Reviewer B tries to read evaluations BEFORE submitting -> should be masked!
    const getBRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${testSession.id}/evaluations`,
      headers: { authorization: `Bearer ${reviewerBToken}` },
    });
    expect(getBRes.statusCode).toBe(200);
    const maskedResult = getBRes.json();
    expect(maskedResult.isMasked).toBe(true);
    expect(maskedResult.evaluations).toHaveLength(0);

    // Admin CAN see all evaluations regardless
    const getAdminRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${testSession.id}/evaluations`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(getAdminRes.statusCode).toBe(200);
    const adminResult = getAdminRes.json();
    expect(adminResult.isMasked).toBe(false);
    expect(adminResult.evaluations).toHaveLength(1);
  });

  it("detects high anchor variance (Δ ≥ 2) across reviewers and flags calibration discussion", async () => {
    // Reviewer B submits evaluation with high variance on AI Collaboration (2 vs 4)
    const submitBRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${testSession.id}/evaluations`,
      headers: { authorization: `Bearer ${reviewerBToken}` },
      payload: {
        scores: validScoresReviewerBHighVariance,
        recommendation: "strong_hire",
        summaryRationale: "Candidate demonstrated exemplary code quality despite AI query doubts.",
      },
    });
    expect(submitBRes.statusCode).toBe(201);

    // Now Reviewer B CAN see all evaluations
    const getBRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${testSession.id}/evaluations`,
      headers: { authorization: `Bearer ${reviewerBToken}` },
    });
    expect(getBRes.statusCode).toBe(200);
    expect(getBRes.json().isMasked).toBe(false);
    expect(getBRes.json().evaluations).toHaveLength(2);

    // Fetch Calibration Consensus
    const calibRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${testSession.id}/calibration`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(calibRes.statusCode).toBe(200);
    const consensus: CalibrationConsensus = calibRes.json();

    expect(consensus.evaluationsCount).toBe(2);
    expect(consensus.status).toBe("requires_calibration");
    expect(consensus.requiresDiscussion).toBe(true);
    expect(consensus.discussionTopics.length).toBeGreaterThan(0);

    const aiCollabDim = consensus.dimensions.find((d) => d.dimensionId === "ai-collaboration");
    expect(aiCollabDim).toBeDefined();
    expect(aiCollabDim?.variance).toBe(2); // 4 - 2 = 2
    expect(aiCollabDim?.alignment).toBe("high_variance");
    expect(aiCollabDim?.requiresDiscussion).toBe(true);
  });

  it("resolves calibration variance when reviewers calibrate scores to within 1 anchor point", async () => {
    // Reviewer B updates their score on AI Collaboration to 3 (variance drops to 4 - 3 = 1)
    const calibratedScoresB = validScoresReviewerBHighVariance.map((s) =>
      s.dimensionId === "ai-collaboration"
        ? { ...s, rating: 3 as const, rationale: "Re-reviewed prompts; prompt iteration was adequate." }
        : s
    );

    const updateBRes = await app.inject({
      method: "POST",
      url: `/api/v1/sessions/${testSession.id}/evaluations`,
      headers: { authorization: `Bearer ${reviewerBToken}` },
      payload: {
        scores: calibratedScoresB,
        recommendation: "hire", // Both agree on "hire"
        summaryRationale: "Calibrated after discussion. Fully aligned on candidate competency.",
      },
    });
    expect(updateBRes.statusCode).toBe(201);

    // Fetch Calibration Consensus
    const calibRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${testSession.id}/calibration`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(calibRes.statusCode).toBe(200);
    const consensus: CalibrationConsensus = calibRes.json();

    expect(consensus.status).toBe("calibrated");
    expect(consensus.requiresDiscussion).toBe(false);
    expect(consensus.consensusRecommendation).toBe("hire");

    const aiCollabDim = consensus.dimensions.find((d) => d.dimensionId === "ai-collaboration");
    expect(aiCollabDim?.variance).toBe(1); // 4 - 3 = 1
    expect(aiCollabDim?.alignment).toBe("moderate");
    expect(aiCollabDim?.requiresDiscussion).toBe(false);
  });

  it("generates automated AI draft baseline scorecard for reviewer guidance", async () => {
    const draftRes = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${testSession.id}/scorecard/ai-draft`,
      headers: { authorization: `Bearer ${reviewerAToken}` },
    });
    expect(draftRes.statusCode).toBe(200);
    const draft: AssessmentScorecard = draftRes.json();

    expect(draft.dimensions).toHaveLength(7);
    expect(draft.scoringMethod).toBe("ai_draft");
    expect(draft.weightedTotalScore).toBeGreaterThanOrEqual(0);
    expect(draft.summaryNotes).toBeDefined();
  });
});
