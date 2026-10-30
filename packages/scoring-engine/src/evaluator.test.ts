import { describe, it, expect } from "vitest";
import { AssessmentEvaluator } from "./evaluator.js";
import { type CandidateSubmission, AssessmentScorecardSchema } from "@ai-copilot/contracts";

describe("AssessmentEvaluator", () => {
  const evaluator = new AssessmentEvaluator();

  it("evaluates a strong candidate submission with full passing tests and valid diff", () => {
    const submission: CandidateSubmission = {
      sessionId: "sess_test_101",
      candidateId: "cand_react_senior_1",
      finalCode: "export const filterTickets = () => ...",
      diff: "--- a/src/queue.ts\n+++ b/src/queue.ts\n@@ -10,3 +10,4 @@\n- return list.filter(t => t.open);\n+ return list.filter(t => t.status === 'open' && t.priority >= minPriority);",
      explanation:
        "The root cause was improper status filtering where inactive tickets were treated as open. I reproduced this via unit tests and refactored the comparator logic cleanly.",
      testResults: [
        { name: "renders ticket list", passed: true, durationMs: 45 },
        { name: "filters tickets by priority", passed: true, durationMs: 32 },
        { name: "handles empty queue state", passed: true, durationMs: 28 },
      ],
      submittedAt: new Date(),
    };

    const scorecard = evaluator.evaluateSubmission(submission, {
      aiPromptCount: 3,
      totalCostUsd: 0.12,
    });

    expect(scorecard.sessionId).toBe("sess_test_101");
    expect(scorecard.scoringMethod).toBe("ai_draft");
    expect(scorecard.dimensions).toHaveLength(7);

    // Verify schema adherence
    const parsed = AssessmentScorecardSchema.safeParse(scorecard);
    expect(parsed.success).toBe(true);

    // Strong submission should get high score (> 80)
    expect(scorecard.weightedTotalScore).toBeGreaterThanOrEqual(85);

    // Debugging implementation dimension should have rating 4 (100% tests passed)
    const debugDim = scorecard.dimensions.find((d) => d.dimensionId === "debugging-implementation");
    expect(debugDim?.rating).toBe(4);
    expect(debugDim?.points).toBe(20);
    expect(debugDim?.evidenceCitations[0]).toContain("3/3 tests passed");
  });

  it("correctly penalizes failing tests and empty diff", () => {
    const failingSubmission: CandidateSubmission = {
      sessionId: "sess_test_102",
      candidateId: "cand_react_junior_2",
      finalCode: "const x = 1;",
      explanation: "Fixed the bug",
      testResults: [
        { name: "renders ticket list", passed: true, durationMs: 45 },
        { name: "filters tickets by priority", passed: false, error: "Assertion failed", durationMs: 30 },
      ],
      submittedAt: new Date(),
    };

    const scorecard = evaluator.evaluateSubmission(failingSubmission, {
      aiPromptCount: 15,
      totalCostUsd: 0.35, // High compute cost
    });

    expect(scorecard.weightedTotalScore).toBeLessThan(65);

    const aiCollabDim = scorecard.dimensions.find((d) => d.dimensionId === "ai-collaboration");
    // Penalized for excessive query churn (>8 prompts), not for dollar cost
    expect(aiCollabDim?.rating).toBe(2);
    expect(aiCollabDim?.evidenceCitations[0]).toContain("High query churn");
    // Telemetry reports cost strictly for audit
    expect(aiCollabDim?.evidenceCitations.some((c) => c.includes("[Company Audit]"))).toBe(true);

    const compDim = scorecard.dimensions.find((d) => d.dimensionId === "code-comprehension");
    expect(compDim?.rating).toBe(1);
  });

  it("does not penalize candidate score on token cost (Architectural Decision #4)", () => {
    const baseSubmission: CandidateSubmission = {
      sessionId: "sess_parity_test",
      candidateId: "cand_parity_1",
      finalCode: "export const solve = () => true;",
      diff: "--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,1 +1,1 @@\n- return false;\n+ return true;",
      explanation: "Identified the root cause in comparator logic and verified with unit tests.",
      testResults: [
        { name: "test 1", passed: true, durationMs: 10 },
        { name: "test 2", passed: true, durationMs: 12 },
      ],
      submittedAt: new Date(),
    };

    const lowCostScorecard = evaluator.evaluateSubmission(baseSubmission, {
      aiPromptCount: 3,
      prompts: [
        "What is the root cause of the comparator descending sort bug?",
        "Can you clarify the edge case where tags is undefined?",
      ],
      totalCostUsd: 0.02,
    });

    const highCostScorecard = evaluator.evaluateSubmission(baseSubmission, {
      aiPromptCount: 3,
      prompts: [
        "What is the root cause of the comparator descending sort bug?",
        "Can you clarify the edge case where tags is undefined?",
      ],
      totalCostUsd: 0.40, // 20x higher cloud cost
    });

    // Dimension rating and points must be strictly identical regardless of cost
    const lowCostDim = lowCostScorecard.dimensions.find((d) => d.dimensionId === "ai-collaboration");
    const highCostDim = highCostScorecard.dimensions.find((d) => d.dimensionId === "ai-collaboration");

    expect(lowCostDim?.rating).toBe(4);
    expect(highCostDim?.rating).toBe(4);
    expect(lowCostDim?.points).toBe(highCostDim?.points);
    expect(lowCostScorecard.weightedTotalScore).toBe(highCostScorecard.weightedTotalScore);
  });
});
