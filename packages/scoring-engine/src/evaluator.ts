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
  aiPolicyMode?: "enabled" | "restricted" | "prohibited";
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
    const policyMode = options.aiPolicyMode ?? "enabled";

    const isAiProhibited = policyMode === "prohibited";
    const isAiRestricted = policyMode === "restricted";

    // Dynamic Rubric Weighting Policy (Phase 2 / Fairness & Scoring Integrity)
    // When AI is prohibited, AI Collaboration (15) and Critical Evaluation (15) are N/A.
    // Weights are cleanly redistributed to technical engineering dimensions so total remains 100.
    const weights = isAiProhibited
      ? {
          codeComprehension: 30,
          problemFraming: 10,
          aiCollaboration: 0,
          criticalEvaluation: 0,
          debuggingImplementation: 30,
          testingVerification: 25,
          explanationJudgment: 5,
        }
      : isAiRestricted
      ? {
          codeComprehension: 25,
          problemFraming: 10,
          aiCollaboration: 15,
          criticalEvaluation: 0, // Patch generation is prohibited under restricted mode
          debuggingImplementation: 25,
          testingVerification: 20,
          explanationJudgment: 5,
        }
      : {
          codeComprehension: 20,
          problemFraming: 10,
          aiCollaboration: 15,
          criticalEvaluation: 15,
          debuggingImplementation: 20,
          testingVerification: 15,
          explanationJudgment: 5,
        };

    // 1. Code Comprehension & Localization
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

    // 2. Problem Framing & Strategy
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

    // 3. AI Collaboration & Inquiry Strategy
    // Architectural Invariant AD #4 & LOOP 8 Scoring Integrity:
    // 1. Token use is ONLY operational cost telemetry. Candidates are NEVER rewarded or penalized for token volume.
    // 2. Candidates who solve problems autonomously without AI must NEVER be penalized.
    // 3. High prompt count must not be arbitrarily penalized if inquiries are targeted and disciplined.
    let aiCollabRating: RubricRatingAnchor = 4;
    const aiCollabCitations: string[] = [];

    if (isAiProhibited) {
      aiCollabRating = 4; // Non-punitive baseline for N/A dimension
      aiCollabCitations.push("[N/A] AI Assistant was prohibited for this task by company policy.");
    } else {
      const prompts = options.prompts ?? [];
      const targetedKeywords = ["root cause", "edge case", "type", "sort", "comparator", "tags", "mutation", "why", "explain", "complexity", "interface", "null", "undefined"];

      if (prompts.length > 0) {
        const targetedInquiries = prompts.filter((p) =>
          targetedKeywords.some((kw) => p.toLowerCase().includes(kw))
        ).length;

        if (targetedInquiries >= 1 || prompts.length <= 6) {
          aiCollabRating = 4;
          aiCollabCitations.push(
            `Effective AI collaboration: Candidate formulated ${prompts.length} focused inquiry iteration(s) advancing task investigation.`
          );
        } else {
          aiCollabRating = 3;
          aiCollabCitations.push(
            `Collaborative inquiries: Formulated ${prompts.length} prompt(s) during task execution.`
          );
        }
      } else if (promptCount > 0) {
        aiCollabRating = 4;
        aiCollabCitations.push(
          `Effective inquiry cadence: Candidate used ${promptCount} targeted inquiry iteration(s).`
        );
      } else {
        // Autonomy fairness rule: Never penalize a candidate for solving problems independently
        aiCollabRating = 4;
        aiCollabCitations.push(
          "Complete engineering autonomy: Candidate resolved the challenge independently without requiring AI assistant queries."
        );
      }

      // Append company budget audit telemetry strictly as non-scoring metadata
      if (totalCost > 0) {
        aiCollabCitations.push(`[Company Audit] Total AI compute cost incurred: $${totalCost.toFixed(4)} USD.`);
      }
    }

    // 4. Critical Evaluation of AI Output
    let critRating: RubricRatingAnchor = 3;
    const critCitations: string[] = [];

    if (isAiProhibited) {
      critRating = 4;
      critCitations.push("[N/A] AI patch generation was prohibited for this task by company policy.");
    } else if (isAiRestricted) {
      critRating = 4;
      critCitations.push("[N/A] AI code patch generation was restricted for this task.");
    } else {
      if (passRatio === 1 && wordCount >= 30) {
        critRating = 4;
        critCitations.push("Verified candidate tailored, verified, and validated implementation rather than blindly trusting output.");
      } else if (passRatio >= 0.5) {
        critRating = 3;
        critCitations.push("Candidate adjusted AI code; some tests remain failing.");
      } else {
        critRating = 2;
        critCitations.push("High failure rate suggests unvalidated adoption of AI-generated suggestions.");
      }
    }

    // 5. Debugging & Implementation Quality
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

    // 6. Testing & Verification Discipline
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

    // 7. Technical Explanation & Judgment
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
      if (weight === 0) return 0;
      const multiplier = rating / 4;
      return Math.round(weight * multiplier * 10) / 10;
    };

    const dimensions: RubricDimensionScore[] = [
      {
        dimensionId: "code-comprehension",
        name: "Code Comprehension & Localization",
        weight: weights.codeComprehension,
        rating: compRating,
        points: calculatePoints(weights.codeComprehension, compRating),
        evidenceCitations: compCitations,
      },
      {
        dimensionId: "problem-framing",
        name: "Problem Framing & Strategy",
        weight: weights.problemFraming,
        rating: framingRating,
        points: calculatePoints(weights.problemFraming, framingRating),
        evidenceCitations: framingCitations,
      },
      {
        dimensionId: "ai-collaboration",
        name: "AI Collaboration Efficiency",
        weight: weights.aiCollaboration,
        rating: aiCollabRating,
        points: calculatePoints(weights.aiCollaboration, aiCollabRating),
        evidenceCitations: aiCollabCitations,
        isNotApplicable: isAiProhibited,
      },
      {
        dimensionId: "critical-evaluation",
        name: "Critical Evaluation of AI Output",
        weight: weights.criticalEvaluation,
        rating: critRating,
        points: calculatePoints(weights.criticalEvaluation, critRating),
        evidenceCitations: critCitations,
        isNotApplicable: isAiProhibited || isAiRestricted,
      },
      {
        dimensionId: "debugging-implementation",
        name: "Debugging & Implementation Quality",
        weight: weights.debuggingImplementation,
        rating: debugRating,
        points: calculatePoints(weights.debuggingImplementation, debugRating),
        evidenceCitations: debugCitations,
      },
      {
        dimensionId: "testing-verification",
        name: "Testing & Verification Discipline",
        weight: weights.testingVerification,
        rating: testRating,
        points: calculatePoints(weights.testingVerification, testRating),
        evidenceCitations: testCitations,
      },
      {
        dimensionId: "explanation-judgment",
        name: "Technical Explanation & Judgment",
        weight: weights.explanationJudgment,
        rating: explRating,
        points: calculatePoints(weights.explanationJudgment, explRating),
        evidenceCitations: explCitations,
      },
    ];

    const weightedTotalScore = Math.round(
      dimensions.reduce((acc, dim) => acc + dim.points, 0) * 10
    ) / 10;

    const summaryNotes =
      `Automated AI-assisted evaluation draft for session ${submission.sessionId}. ` +
      `Test suite pass rate: ${Math.round(passRatio * 100)}% (${passedTests}/${totalTests}). ` +
      `Policy: ${policyMode.toUpperCase()}. ` +
      `Human interviewer review is required prior to candidate hiring calibration.`;

    return {
      sessionId: submission.sessionId,
      candidateId: submission.candidateId,
      rubricVersion: "1.1.0",
      dimensions,
      weightedTotalScore,
      scoringMethod: "ai_draft",
      summaryNotes,
      createdAt: new Date(),
    };
  }
}
