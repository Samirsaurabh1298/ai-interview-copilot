import {
  type CandidateSubmission,
  type AssessmentScorecard,
  type RubricDimensionScore,
  type RubricRatingAnchor,
} from "@ai-copilot/contracts";

export interface EvaluationOptions {
  aiPromptCount?: number;
  aiTokensUsed?: number;
  totalCostUsd?: number;
  prompts?: string[];
  referencePassingTestsCount?: number;
}

export class AssessmentEvaluator {
  public evaluateSubmission(
    submission: CandidateSubmission,
    options: EvaluationOptions = {}
  ): AssessmentScorecard {
    const totalTests = submission.testResults.length;
    const passedTests = submission.testResults.filter((t) => t.passed).length;
    const passRatio = totalTests > 0 ? passedTests / totalTests : 0;

    const diffLines = submission.diff ? submission.diff.split("\n") : [];
    const addedLines = diffLines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
    const removedLines = diffLines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
    const wordCount = submission.explanation.trim().split(/\s+/).filter(Boolean).length;

    const promptCount = options.aiPromptCount ?? 0;
    const totalCost = options.totalCostUsd ?? 0;

    // 1. Code Comprehension (Weight: 20)
    let compRating: RubricRatingAnchor = 2;
    const compCitations: string[] = [];
    if (addedLines + removedLines > 0 && addedLines + removedLines < 80) {
      compRating = passRatio >= 0.8 ? 4 : 3;
      compCitations.push(
        `Targeted code delta: +${addedLines}/-${removedLines} lines indicating precise bug localization.`
      );
    } else if (addedLines + removedLines >= 80) {
      compRating = passRatio >= 0.8 ? 3 : 2;
      compCitations.push(
        `Diff span was broad (+${addedLines}/-${removedLines} lines); localization could be more concise.`
      );
    } else {
      compRating = 1;
      compCitations.push("No code changes or diff provided for review.");
    }

    // 2. Problem Framing & Strategy (Weight: 10)
    let framingRating: RubricRatingAnchor = 2;
    const framingCitations: string[] = [];
    if (wordCount >= 50 && (submission.explanation.toLowerCase().includes("root cause") || submission.explanation.toLowerCase().includes("reproduce"))) {
      framingRating = 4;
      framingCitations.push("Candidate explicitly articulated the root cause and reproduction condition.");
    } else if (wordCount >= 25) {
      framingRating = 3;
      framingCitations.push("Candidate described the issue and intended resolution with sufficient clarity.");
    } else {
      framingRating = 1;
      framingCitations.push("Explanation lacked structured root-cause analysis or problem framing.");
    }

    // 3. AI Collaboration & Inquiry Strategy (Weight: 15)
    // Architectural Decision #4: Token expenditure is a company cost control, NOT a candidate performance score.
    // Score purely on inquiry specificity, prompt intent, and iterative decomposition.
    let aiCollabRating: RubricRatingAnchor = 3;
    const aiCollabCitations: string[] = [];

    const prompts = options.prompts ?? [];
    const hasStructuredPrompts = prompts.length > 0;
    const targetedKeywords = ["root cause", "edge case", "type", "sort", "comparator", "tags", "mutation", "why", "explain"];
    const highQualityInquiries = prompts.filter((p) =>
      targetedKeywords.some((kw) => p.toLowerCase().includes(kw))
    ).length;

    if (hasStructuredPrompts) {
      if (highQualityInquiries >= 2 || (prompts.length >= 2 && prompts.length <= 8 && highQualityInquiries >= 1)) {
        aiCollabRating = 4;
        aiCollabCitations.push(
          `Strong AI collaboration: Candidate formulated ${prompts.length} focused prompt(s) targeting specific edge cases and architecture patterns.`
        );
      } else if (prompts.length > 8) {
        aiCollabRating = 2;
        aiCollabCitations.push(
          `Developing AI collaboration: High prompt churn (${prompts.length} prompts) with low query specificity, suggesting trial-and-error.`
        );
      } else {
        aiCollabRating = 3;
        aiCollabCitations.push(
          `Effective AI collaboration: Formulated ${prompts.length} clear prompt(s) to guide investigation.`
        );
      }
    } else if (promptCount >= 1 && promptCount <= 8) {
      // Fallback when only count telemetry is available
      aiCollabRating = 4;
      aiCollabCitations.push(
        `Effective query cadence: Candidate used ${promptCount} targeted inquiry iterations to advance task.`
      );
    } else if (promptCount > 8) {
      aiCollabRating = 2;
      aiCollabCitations.push(
        `High query churn: ${promptCount} prompt iterations indicates excessive dependence on AI generation over structured reasoning.`
      );
    } else {
      aiCollabRating = 3;
      aiCollabCitations.push("Candidate completed engineering task autonomously with minimal AI assistance.");
    }

    // Append company budget audit telemetry strictly as non-scoring metadata
    if (totalCost > 0) {
      aiCollabCitations.push(`[Company Audit] Total AI compute cost incurred: $${totalCost.toFixed(4)} USD.`);
    }

    // 4. Critical Evaluation of AI (Weight: 15)
    let critRating: RubricRatingAnchor = 3;
    const critCitations: string[] = [];
    if (passRatio === 1 && wordCount >= 30) {
      critRating = 4;
      critCitations.push("Verified candidate tailored and verified implementation rather than blindly trusting output.");
    } else if (passRatio >= 0.5) {
      critRating = 3;
      critCitations.push("Candidate adjusted AI code; some tests remain failing.");
    } else {
      critRating = 2;
      critCitations.push("High failure rate suggests unvalidated adoption of AI-generated suggestions.");
    }

    // 5. Debugging & Implementation (Weight: 20)
    let debugRating: RubricRatingAnchor = 1;
    const debugCitations: string[] = [];
    if (passRatio === 1) {
      debugRating = 4;
      debugCitations.push(`100% test pass rate (${passedTests}/${totalTests} tests passed).`);
    } else if (passRatio >= 0.75) {
      debugRating = 3;
      debugCitations.push(`Strong pass rate (${passedTests}/${totalTests} tests passed).`);
    } else if (passRatio >= 0.4) {
      debugRating = 2;
      debugCitations.push(`Partial implementation (${passedTests}/${totalTests} tests passed).`);
    } else {
      debugRating = 1;
      debugCitations.push(`Failing majority of tests (${passedTests}/${totalTests} tests passed).`);
    }

    // 6. Testing & Verification Discipline (Weight: 15)
    let testRating: RubricRatingAnchor = 1;
    const testCitations: string[] = [];
    if (totalTests > 0 && passRatio === 1) {
      testRating = 4;
      testCitations.push(`Candidate executed full verification test suite successfully (${totalTests} test cases).`);
    } else if (totalTests > 0) {
      testRating = 3;
      testCitations.push(`Executed test runner; ${totalTests - passedTests} test(s) still failing.`);
    } else {
      testRating = 1;
      testCitations.push("No test execution results recorded prior to submission.");
    }

    // 7. Technical Explanation & Judgment (Weight: 5)
    let explRating: RubricRatingAnchor = 2;
    const explCitations: string[] = [];
    if (wordCount >= 40) {
      explRating = 4;
      explCitations.push(`Detailed technical rationale provided (${wordCount} words).`);
    } else if (wordCount >= 15) {
      explRating = 3;
      explCitations.push(`Concise explanation provided (${wordCount} words).`);
    } else {
      explRating = 1;
      explCitations.push("Superficial or missing explanation of solution.");
    }

    const calculatePoints = (weight: number, rating: RubricRatingAnchor): number => {
      // 1 -> 25%, 2 -> 50%, 3 -> 75%, 4 -> 100%
      const multiplier = rating / 4;
      return Math.round(weight * multiplier * 10) / 10;
    };

    const dimensions: RubricDimensionScore[] = [
      {
        dimensionId: "code-comprehension",
        name: "Code Comprehension & Localization",
        weight: 20,
        rating: compRating,
        points: calculatePoints(20, compRating),
        evidenceCitations: compCitations,
      },
      {
        dimensionId: "problem-framing",
        name: "Problem Framing & Strategy",
        weight: 10,
        rating: framingRating,
        points: calculatePoints(10, framingRating),
        evidenceCitations: framingCitations,
      },
      {
        dimensionId: "ai-collaboration",
        name: "AI Collaboration Efficiency",
        weight: 15,
        rating: aiCollabRating,
        points: calculatePoints(15, aiCollabRating),
        evidenceCitations: aiCollabCitations,
      },
      {
        dimensionId: "critical-evaluation",
        name: "Critical Evaluation of AI Output",
        weight: 15,
        rating: critRating,
        points: calculatePoints(15, critRating),
        evidenceCitations: critCitations,
      },
      {
        dimensionId: "debugging-implementation",
        name: "Debugging & Implementation Quality",
        weight: 20,
        rating: debugRating,
        points: calculatePoints(20, debugRating),
        evidenceCitations: debugCitations,
      },
      {
        dimensionId: "testing-verification",
        name: "Testing & Verification Discipline",
        weight: 15,
        rating: testRating,
        points: calculatePoints(15, testRating),
        evidenceCitations: testCitations,
      },
      {
        dimensionId: "explanation-judgment",
        name: "Technical Explanation & Judgment",
        weight: 5,
        rating: explRating,
        points: calculatePoints(5, explRating),
        evidenceCitations: explCitations,
      },
    ];

    const weightedTotalScore = Math.round(
      dimensions.reduce((acc, dim) => acc + dim.points, 0) * 10
    ) / 10;

    const summaryNotes =
      `Automated AI-assisted evaluation draft for session ${submission.sessionId}. ` +
      `Test suite pass rate: ${Math.round(passRatio * 100)}% (${passedTests}/${totalTests}). ` +
      `Human interviewer review is required prior to candidate hiring calibration.`;

    return {
      sessionId: submission.sessionId,
      candidateId: submission.candidateId,
      rubricVersion: "1.0.0",
      dimensions,
      weightedTotalScore,
      scoringMethod: "ai_draft",
      summaryNotes,
      createdAt: new Date(),
    };
  }
}
