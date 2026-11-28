import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type {
  AcceptInvitationResponse,
  VerifyInvitationResponse,
  PracticeChallenge,
  PracticeFeedbackCard,
} from "@ai-copilot/contracts";
import { CandidateOnboarding } from "./CandidateOnboarding.js";
import { AssessmentWorkspace } from "./AssessmentWorkspace.js";
import { PracticeStudio } from "./PracticeStudio.js";
import { ApiClient } from "../services/apiClient.js";

function makeToolPolicy() {
  return {
    allowedProvider: "openai" as const,
    allowedModel: "gpt-4o-mini",
    maxBudgetUsd: 0.25,
    warningThresholdPercent: 80,
    timeLimitSeconds: 3600,
    allowInternetSearch: false,
    allowDocumentation: true,
  };
}

function makeInvitationVerifyPayload(): VerifyInvitationResponse {
  return {
    invitation: {
      id: "inv_1",
      organizationId: "org_1",
      templateId: "tmpl_1",
      versionId: "ver_1",
      candidateEmail: "dev@example.com",
      candidateName: "Devin Engineer",
      invitationToken: "a".repeat(64),
      status: "pending",
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: new Date(),
    },
    templateTitle: "Senior Fullstack & Multi-File Triage Assessment",
    templateDescription: "Fix bugs across multiple modules and defend your changes.",
    targetRole: "Senior Software Engineer",
    difficulty: "senior",
    durationMinutes: 60,
    attemptDurationMinutes: 60,
    submissionDeadlineDays: 7,
    tasks: [],
    toolPolicy: makeToolPolicy(),
    organizationName: "Acme Engineering",
  };
}

function makeSessionBootstrap(): AcceptInvitationResponse {
  return {
    invitation: makeInvitationVerifyPayload().invitation,
    sessionId: "sess_cand_flow_1",
    candidateToken: "jwt_candidate_mock",
    templateId: "tmpl_1",
    starterCode: "export function fixMe() { return 1; }",
    verificationTestCode: "test('ok', () => {});",
    tasks: [
      {
        id: "task_q_1",
        type: "question_set",
        title: "Section 1: System Fundamentals",
        description: "Answer core architectural questions without AI assistance.",
        orderIndex: 0,
        estimatedMinutes: 15,
        weight: 30,
        points: 30,
        isRequired: true,
        aiPolicy: {
          enabled: false,
          mode: "prohibited",
          allowedModel: "gpt-4o-mini",
          maxBudgetUsd: 0.15,
          candidateDisclosure: "AI assistance is strictly prohibited during fundamentals.",
        },
        config: {
          questions: [
            {
              id: "q1",
              format: "mcq_single",
              prompt: "Which primitive schedules non-blocking React UI updates?",
              points: 10,
              options: [
                { id: "opt_t", text: "useTransition" },
                { id: "opt_f", text: "blocking while loop" },
              ],
            },
          ],
        },
      },
      {
        id: "task_repo_1",
        type: "repository_task",
        title: "Section 2: Multi-File Checkout Triage",
        description: "Fix inventory rollback and coupon clamping with Weak AI oversight.",
        orderIndex: 1,
        estimatedMinutes: 45,
        weight: 70,
        points: 70,
        isRequired: true,
        aiPolicy: {
          enabled: true,
          mode: "flawed_junior",
          allowedModel: "gpt-4o-mini",
          maxBudgetUsd: 0.25,
          candidateDisclosure: "Weak Junior AI active: verify every suggestion independently.",
        },
        config: {
          action: "debug",
          targetLanguage: "typescript",
          primaryFilePath: "src/checkout.ts",
          starterFiles: {
            "src/types.ts": "export interface Order { qty: number; }",
            "src/checkout.ts": "export function processOrder(qty: number) { return qty * 10; }",
          },
          readOnlyFiles: ["src/types.ts"],
          verificationTestCode: "test('computes total', () => {});",
        },
      },
    ],
    toolPolicy: makeToolPolicy(),
    durationMinutes: 60,
    remainingSeconds: 3600,
    status: "ACTIVE",
    isSubmitted: false,
  };
}

describe("Critical Candidate Flows Smoke & Integration Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.spyOn(ApiClient, "ingestSessionEvents").mockResolvedValue({
      acceptedCount: 1,
      latestSequenceNumber: 1,
    });
    vi.spyOn(ApiClient, "getSessionHeartbeat").mockResolvedValue({
      sessionId: "sess_cand_flow_1",
      status: "ACTIVE",
      remainingSeconds: 3595,
      isExpired: false,
      inGracePeriod: false,
      isPaused: false,
      consumedBudgetUsd: 0.002,
      remainingBudgetUsd: 0.248,
      budgetWarning: false,
    });
    vi.spyOn(ApiClient, "getBudgetStatus").mockResolvedValue({
      maxBudgetUsd: 0.25,
      consumedBudgetUsd: 0.002,
      remainingBudgetUsd: 0.248,
      isWarningTriggered: false,
      isExhausted: false,
      percentUsed: 0.8,
    });
    vi.spyOn(ApiClient, "autosaveWorkspace").mockResolvedValue({
      sessionId: "sess_cand_flow_1",
      status: "ACTIVE",
      lastSavedAt: new Date(),
      revision: 1,
    });
  });

  it("Flow 1a: CandidateOnboarding enforces integrity agreement before accepting invitation", async () => {
    vi.spyOn(ApiClient, "verifyInvitation").mockResolvedValue(makeInvitationVerifyPayload());
    vi.spyOn(ApiClient, "acceptInvitation").mockResolvedValue(makeSessionBootstrap());
    const onStarted = vi.fn();

    render(
      <CandidateOnboarding
        invitationToken={"a".repeat(64)}
        onAssessmentStarted={onStarted}
        onCancel={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Senior Fullstack & Multi-File Triage Assessment")).toBeInTheDocument();
    });
    expect(screen.getByText("Acme Engineering")).toBeInTheDocument();
    expect(screen.getByText("60 Minutes")).toBeInTheDocument();

    const startBtn = screen.getByRole("button", { name: /Begin Assessment/i });
    expect(startBtn).toBeDisabled();

    const agreeCheckbox = screen.getByRole("checkbox");
    fireEvent.click(agreeCheckbox);
    expect(startBtn).toBeEnabled();

    fireEvent.click(startBtn);
    await waitFor(() => {
      expect(ApiClient.acceptInvitation).toHaveBeenCalledWith("a".repeat(64));
      expect(onStarted).toHaveBeenCalledTimes(1);
    });
  });

  it("Flow 1b: CandidateOnboarding renders error fallback cleanly when invitation is invalid", async () => {
    vi.spyOn(ApiClient, "verifyInvitation").mockRejectedValue(
      new Error("Invitation token expired or revoked")
    );

    render(
      <CandidateOnboarding
        invitationToken="expired_tok"
        onAssessmentStarted={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Invitation Unavailable")).toBeInTheDocument();
    });
    expect(screen.getByText("Invitation token expired or revoked")).toBeInTheDocument();
  });

  it("Flow 2: AssessmentWorkspace enforces AI policy, explicit diff review, policy-disabled runner notice, and diff-anchored submission lock", async () => {
    vi.spyOn(ApiClient, "generateAnswer").mockResolvedValue({
      question: "Please propose a minimal bugfix",
      category: "debugging",
      assumptions: [],
      diagnosis: ["Checkout misses coupon clamping."],
      explanation: "Clamp negative discounts cleanly.",
      approach: ["Guard total >= 0"],
      code: "export function processOrder(qty: number) { return Math.max(0, qty * 10); }",
      codeChanges: [
        {
          path: "src/checkout.ts",
          diff: "- return qty * 10;\n+ return Math.max(0, qty * 10);",
          description: "Clamp discount total",
        },
      ],
      tests: [{ name: "non-negative", purpose: "Ensure total is non-negative" }],
      edgeCases: [],
      followUpQuestions: [],
      limitations: [],
      confidence: 0.9,
      provider: "mock",
      model: "gpt-4o-mini",
      usage: { inputTokens: 120, outputTokens: 140, estimatedCostUsd: 0.001 },
    });

    vi.spyOn(ApiClient, "validateCode").mockRejectedValue(
      new Error("RUNNER_EXECUTION_DISABLED: Untrusted candidate code execution is disabled")
    );

    const submitSpy = vi.spyOn(ApiClient, "submitAssessment").mockResolvedValue({
      submissionId: "sub_abc_123",
      sessionId: "sess_cand_flow_1",
      status: "submitted",
      submittedAt: new Date(),
      submissionFingerprint: "f".repeat(64),
      artifact: {
        id: "sub_abc_123",
        sessionId: "sess_cand_flow_1",
        organizationId: "org_1",
        templateId: "tmpl_1",
        candidateName: "Devin Engineer",
        candidateEmail: "dev@example.com",
        submittedAt: new Date(),
        finalCode: "export function processOrder(qty: number) { return Math.max(0, qty * 10); }",
        starterCode: "export function fixMe() { return 1; }",
        codeDiff: { additions: 1, deletions: 1, totalChanges: 2, unifiedDiff: "+ clamped" },
        testExecutionLog: {
          status: "NOT_RUN",
          success: false,
          passed: null,
          passedCount: 0,
          totalCount: 0,
          durationMs: 0,
          tests: [],
          exitCode: null,
        },
        technicalExplanation: "Fixed negative discount overflow and verified inventory.",
        telemetrySummary: {
          totalEvents: 3,
          aiQueriesCount: 1,
          consumedAiBudgetUsd: 0.001,
          patchDecisions: { accepted: 1, rejected: 0 },
          attentionMetrics: { blurCount: 0, pasteCount: 0 },
        },
        templateContentHash: "h".repeat(64),
        submissionFingerprint: "f".repeat(64),
      },
    });

    vi.spyOn(ApiClient, "evaluateAssessment").mockResolvedValue({
      overallScore: 88,
      recommendation: "hire",
      dimensions: [],
      strengths: [],
      risks: [],
      calibrationNotes: "Strong comprehension.",
    } as any);

    render(<AssessmentWorkspace sessionData={makeSessionBootstrap()} onExitSession={vi.fn()} />);

    // Task 1 has prohibited AI policy
    expect(screen.getByText("AI Assistance Prohibited")).toBeInTheDocument();

    // Switch to Task 2 (repository_task with flawed_junior policy)
    fireEvent.click(screen.getAllByText(/Multi-File Checkout Triage/i)[0]!);
    await waitFor(() => {
      expect(screen.getByText("Flawed Junior AI (Verify Outputs)")).toBeInTheDocument();
    });

    // Explicit Patch Review (AD #7)
    fireEvent.click(screen.getByRole("button", { name: /Propose with AI/i }));
    await waitFor(() => {
      expect(screen.getByText("Review Proposed Solution Patch")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Accept & Apply Patch to Editor/i }));

    // Graceful degradation when runner execution is disabled by pilot policy
    fireEvent.click(screen.getByRole("button", { name: /Run Tests/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/Code execution is disabled by policy for this pilot session/i)
      ).toBeInTheDocument();
    });

    // Open Submission + Post-Fix Defense Modal
    fireEvent.click(screen.getByRole("button", { name: /Submit Solution/i }));
    await waitFor(() => {
      expect(screen.getByText("Submit Solution & Post-Fix Technical Defense")).toBeInTheDocument();
    });

    const summaryBox = screen.getByPlaceholderText(/Root cause identified/i);
    fireEvent.change(summaryBox, {
      target: { value: "Fixed negative coupon totals and rolled back reserved stock on error." },
    });

    const defenseBoxes = screen.getAllByPlaceholderText(/Explain the exact behavior/i);
    expect(defenseBoxes.length).toBeGreaterThanOrEqual(1);
    fireEvent.change(defenseBoxes[0]!, {
      target: { value: "Math.max clamps total >= 0 so clearance coupons cannot go negative." },
    });

    fireEvent.click(screen.getByRole("button", { name: /Generate Official Scorecard/i }));

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Assessment Window Closed")).toBeInTheDocument();
    });

    const submittedPayload = submitSpy.mock.calls[0]?.[1];
    expect(submittedPayload?.defenseResponses?.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("SUBMITTED (LOCKED)")).toBeInTheDocument();
    expect(screen.getByText("f".repeat(64))).toBeInTheDocument();
  });

  it("Flow 3: PracticeStudio supports multi-file checkout triage, Weak AI toggle, Strict Exam mode, and feedback report", async () => {
    const multiFileChallenge: PracticeChallenge = {
      id: "chal_multi_file_checkout_triage",
      slug: "multi-file-checkout-rollback-debug",
      title: "Multi-File Checkout Pipeline: Inventory Leak & Discount Over-Application",
      track: "fullstack",
      difficulty: "senior",
      language: "typescript",
      challengeType: "repository_task",
      estimatedMinutes: 30,
      primaryFilePath: "src/checkout.ts",
      readOnlyFiles: ["src/types.ts"],
      aiPolicyMode: "flawed_junior",
      description: "Fix stock rollback and coupon over-discounting across multiple files.",
      starterCode: "export function processCheckout() {}",
      starterFiles: {
        "src/types.ts": "export interface Order { sku: string; }",
        "src/checkout.ts": "export function processCheckout() { return 0; }",
      },
      verificationTestCode: "test('checkout rollback', () => {});",
      hints: [],
      simulatedAiBudgetUsd: 0.25,
      tags: ["multi-file", "rollback"],
    };

    const mockFeedback: PracticeFeedbackCard = {
      id: "pcard_1",
      challengeId: multiFileChallenge.id,
      challengeTitle: multiFileChallenge.title,
      track: "fullstack",
      difficulty: "senior",
      compositeScore: 91,
      recommendation: "strong_hire",
      submittedAt: new Date(),
      dimensions: [
        {
          dimensionId: "code-comprehension",
          name: "Code Comprehension & Localization",
          rating: 4,
          weight: 20,
          weightedScore: 20,
          levelLabel: "Exemplary",
          rationale: "Fixed multi-file interactions cleanly.",
          keyStrengths: ["Preserved read-only contracts"],
          growthAreas: [],
        },
      ],
      aiRelianceIndex: {
        score: 24,
        label: "Critical & Methodical Reviewer",
        patchesAccepted: 0,
        patchesRejected: 1,
        scrutinyRatio: 1,
        queriesCount: 2,
      },
      speedAndPrecision: {
        elapsedMinutes: 4.5,
        timeAllocatedMinutes: 30,
        testPassRatePercent: 100,
        testsPassed: 5,
        testsTotal: 5,
      },
      executiveSummary: "[Strict Exam Mode] Completed in 4.5m with 100% test pass rate.",
      actionableTakeaways: ["Great rollback invariant coverage."],
      recommendedNextChallenges: ["async-concurrency-limiter"],
    };

    vi.spyOn(ApiClient, "listPracticeChallenges").mockResolvedValue({
      challenges: [multiFileChallenge],
      total: 1,
    });
    const submitPracticeSpy = vi
      .spyOn(ApiClient, "evaluatePracticeSubmission")
      .mockResolvedValue({ feedback: mockFeedback });

    render(<PracticeStudio />);

    await waitFor(() => {
      expect(screen.getByText(multiFileChallenge.title)).toBeInTheDocument();
    });
    expect(screen.getByText("Multi-File (2)")).toBeInTheDocument();
    expect(screen.getByText("Weak Junior AI")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Start Challenge/i }));

    await waitFor(() => {
      expect(screen.getByText("Weak AI Mode")).toBeInTheDocument();
    });

    // Enable Strict Exam Mode countdown
    fireEvent.click(screen.getByRole("button", { name: /Strict Exam: OFF/i }));
    expect(screen.getByRole("button", { name: /Strict Exam: ON/i })).toBeInTheDocument();

    // Switch to read-only types file and verify read-only guard banner
    fireEvent.click(screen.getByRole("button", { name: /src\/types\.ts/i }));
    expect(screen.getByText(/Read-Only/i)).toBeInTheDocument();

    // Switch back and submit with post-fix defense
    fireEvent.click(screen.getByRole("button", { name: /src\/checkout\.ts/i }));
    fireEvent.click(screen.getByRole("button", { name: /Submit for Diagnostic Review/i }));

    await waitFor(() => {
      expect(screen.getByText("Submit Solution for Diagnostic Review")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/Summarize root cause of defect/i), {
      target: { value: "Added try/catch inventory rollback in checkout.ts." },
    });
    fireEvent.change(screen.getByPlaceholderText(/Defend your exact diff/i), {
      target: { value: "Release stock whenever applyDiscount throws invalid coupon." },
    });

    fireEvent.click(screen.getByRole("button", { name: /Generate Diagnostic Feedback/i }));

    await waitFor(() => {
      expect(submitPracticeSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Practice Assessment Diagnostic Report")).toBeInTheDocument();
    });
    expect(screen.getByText("Critical & Methodical Reviewer")).toBeInTheDocument();
  });
});
