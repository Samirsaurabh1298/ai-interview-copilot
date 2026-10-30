import React, { useState, useEffect, useRef } from "react";
import {
  Clock,
  Coins,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  RotateCcw,
  Sparkles,
  FileCode,
  ListFilter,
  Check,
  ChevronRight,
  ShieldCheck,
  Terminal,
  Loader2,
  Eye,
  Copy,
} from "lucide-react";
import { ApiClient } from "../services/apiClient.js";
import { ScorecardModal } from "./ScorecardModal.js";
import type {
  SessionBudgetStatus,
  AIResponse,
  CodeValidationResponse,
  AssessmentScorecard,
} from "@ai-copilot/contracts";

const STARTER_CODE = `export const PRIORITY_WEIGHTS: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

export interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  tags?: string[];
  createdAt: number;
}

export interface FilterOptions {
  searchQuery?: string;
  status?: string[];
  priority?: string[];
  tags?: string[];
}

export interface SortOptions {
  field: "createdAt" | "priority" | "title";
  order: "asc" | "desc";
}

/**
 * Filter and sort support tickets.
 * DEFECT 1: Priority order in descending mode sorts urgent tickets to bottom.
 * DEFECT 2: Direct in-place mutation of tickets array.
 * DEFECT 3: Multi-tag filtering throws when ticket has undefined tags.
 */
export function filterAndSortTickets(
  tickets: Ticket[],
  filters: FilterOptions,
  sort: SortOptions
): Ticket[] {
  const result = tickets.filter((ticket) => {
    // 1. Text search
    if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
      const q = filters.searchQuery.toLowerCase();
      if (!ticket.title.toLowerCase().includes(q) && !ticket.description.toLowerCase().includes(q)) {
        return false;
      }
    }

    // 2. Status filter
    if (filters.status && filters.status.length > 0) {
      if (!filters.status.includes(ticket.status)) return false;
    }

    // 3. Priority filter
    if (filters.priority && filters.priority.length > 0) {
      if (!filters.priority.includes(ticket.priority)) return false;
    }

    // 4. Tag filter - [BUG: crashes if tags is undefined]
    if (filters.tags && filters.tags.length > 0) {
      const matchesAll = filters.tags.every((t) => ticket.tags.includes(t));
      if (!matchesAll) return false;
    }

    return true;
  });

  // 5. Sorting - [BUG: Inverted priority comparator and in-place mutation]
  result.sort((a, b) => {
    if (sort.field === "createdAt") {
      return sort.order === "asc" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt;
    }
    if (sort.field === "priority") {
      const weightA = PRIORITY_WEIGHTS[a.priority] || 0;
      const weightB = PRIORITY_WEIGHTS[b.priority] || 0;
      return sort.order === "desc" ? weightA - weightB : weightB - weightA;
    }
    if (sort.field === "title") {
      const cmp = a.title.localeCompare(b.title);
      return sort.order === "asc" ? cmp : -cmp;
    }
    return 0;
  });

  return result;
}
`;

const VERIFICATION_TESTS_CODE = `
const SAMPLE_TICKETS = [
  { id: "tick-1", title: "DB connection timeout", description: "Gateway 504", priority: "urgent", status: "open", tags: ["backend", "db"], createdAt: 100 },
  { id: "tick-2", title: "Button alignment", description: "Safari overflow", priority: "low", status: "open", tags: ["frontend"], createdAt: 200 },
  { id: "tick-3", title: "Payment webhook failure", description: "Stripe error", priority: "high", status: "in_progress", tags: ["payments", "backend"], createdAt: 300 },
  { id: "tick-4", title: "Update copyright", description: "Footer year", priority: "low", status: "resolved", createdAt: 400 },
];

test("Filters by search query in title or description", () => {
  const res = filterAndSortTickets(SAMPLE_TICKETS, { searchQuery: "timeout" }, { field: "createdAt", order: "desc" });
  if (res.length !== 1 || res[0].id !== "tick-1") throw new Error("Expected single matching ticket for timeout");
});

test("Filters by ticket status", () => {
  const res = filterAndSortTickets(SAMPLE_TICKETS, { status: ["open"] }, { field: "createdAt", order: "desc" });
  if (res.length !== 2) throw new Error("Expected 2 open tickets");
});

test("Sorts tickets descending by priority (urgent -> high -> medium -> low)", () => {
  const res = filterAndSortTickets(SAMPLE_TICKETS, {}, { field: "priority", order: "desc" });
  if (res[0].priority !== "urgent") throw new Error("First ticket must be urgent in descending sort");
  if (res[1].priority !== "high") throw new Error("Second ticket must be high in descending sort");
});

test("Handles tickets with missing tags array without throwing", () => {
  const res = filterAndSortTickets(SAMPLE_TICKETS, { tags: ["backend"] }, { field: "createdAt", order: "desc" });
  if (res.length !== 2) throw new Error("Expected 2 tickets with backend tag");
});

test("Sorting does not mutate input array in place", () => {
  const copy = [...SAMPLE_TICKETS];
  const firstIdBefore = copy[0].id;
  filterAndSortTickets(copy, {}, { field: "priority", order: "desc" });
  if (copy[0].id !== firstIdBefore) throw new Error("Original array was mutated in place");
});
`;

interface AssessmentChatMessage {
  role: "candidate" | "copilot";
  text: string;
  code?: string | undefined;
  diff?: string | undefined;
  patchStatus?: "proposed" | "accepted" | "rejected" | undefined;
}

export const AssessmentWorkspace: React.FC = () => {
  const [sessionId] = useState(() => `sess_${Date.now().toString(36)}`);
  const [candidateId] = useState("cand_frontend_pilot_1");
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(3600); // 60 mins
  const [code, setCode] = useState(STARTER_CODE);
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  // Proposed Patch Review Modal State (Architectural Decision #7)
  const [reviewingPatch, setReviewingPatch] = useState<{
    code: string;
    diff?: string | undefined;
    messageIdx?: number | undefined;
  } | null>(null);

  // Budget state
  const [budgetStatus, setBudgetStatus] = useState<SessionBudgetStatus>({
    maxBudgetUsd: 0.25,
    consumedBudgetUsd: 0,
    remainingBudgetUsd: 0.25,
    percentUsed: 0,
    isWarningTriggered: false,
    isExhausted: false,
  });

  // Active tabs
  const [leftTab, setLeftTab] = useState<"brief" | "ai">("brief");
  const [activeBottomTab, setActiveBottomTab] = useState<"tests" | "output">("tests");

  // AI chat state
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiHistory, setAiHistory] = useState<AssessmentChatMessage[]>([
    {
      role: "copilot",
      text: "Hello! I am your AI assessment copilot. You can ask me to explain algorithms, clarify TypeScript patterns, or analyze edge cases. Keep queries focused to stay within your $0.25 session budget.",
    },
  ]);
  const [isAskingAI, setIsAskingAI] = useState(false);

  // Sandbox Test Runner State
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResult, setTestResult] = useState<CodeValidationResponse | null>(null);

  // Submission State
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scorecard, setScorecard] = useState<AssessmentScorecard | null>(null);
  const [isScorecardOpen, setIsScorecardOpen] = useState(false);

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll budget status
  const refreshBudget = async () => {
    try {
      const status = await ApiClient.getBudgetStatus(sessionId);
      setBudgetStatus(status);
    } catch {
      // Session starts at $0.00
    }
  };

  useEffect(() => {
    refreshBudget();
    const interval = setInterval(refreshBudget, 6000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Run isolated tests
  const handleRunVerification = async (codeToRun?: string) => {
    const targetCode = typeof codeToRun === "string" ? codeToRun : code;
    setIsRunningTests(true);
    setActiveBottomTab("tests");
    try {
      const result = await ApiClient.validateCode({
        language: "typescript",
        code: targetCode,
        testCode: VERIFICATION_TESTS_CODE,
        timeoutMs: 4000,
        memoryLimitMb: 128,
      });
      setTestResult(result);
    } catch (err: unknown) {
      setTestResult({
        success: false,
        passed: false,
        exitCode: 1,
        stdout: "",
        stderr: err instanceof Error ? err.message : "Validation failure",
        durationMs: 0,
        tests: [],
        sandboxed: true,
      });
    } finally {
      setIsRunningTests(false);
    }
  };

  // Architectural Decision #7: Candidate Explicit Review Actions on Proposed AI Patch
  const handleAcceptPatch = (patchCode: string, messageIdx?: number) => {
    setCode(patchCode);
    setAppliedNotice("✓ Proposed patch accepted and applied to src/useTicketQueue.ts. Click 'Run Tests' to verify.");
    setTimeout(() => setAppliedNotice(null), 6000);

    if (messageIdx !== undefined) {
      setAiHistory((prev) =>
        prev.map((msg, i) => (i === messageIdx ? { ...msg, patchStatus: "accepted" } : msg))
      );
    }
    setReviewingPatch(null);
  };

  const handleRejectPatch = (messageIdx?: number) => {
    setAppliedNotice("Proposed patch rejected. Editor buffer was preserved untouched.");
    setTimeout(() => setAppliedNotice(null), 4000);

    if (messageIdx !== undefined) {
      setAiHistory((prev) =>
        prev.map((msg, i) => (i === messageIdx ? { ...msg, patchStatus: "rejected" } : msg))
      );
    }
    setReviewingPatch(null);
  };

  // Request Solution Proposal from AI without auto-modifying editor buffer
  const handleRequestSolutionProposal = async () => {
    if (isAskingAI || budgetStatus.isExhausted) return;
    setLeftTab("ai");
    const promptText = "Please propose a complete corrected TypeScript solution for filterAndSortTickets to fix descending priority sorting, array mutation in place, and missing tags errors.";
    setAiHistory((prev) => [...prev, { role: "candidate", text: promptText }]);
    setIsAskingAI(true);

    try {
      const answer = await ApiClient.generateAnswer(
        {
          task: "debug",
          question: promptText,
          code,
          language: "typescript",
          responseStyle: "concise",
          context: [],
        },
        "groq",
        sessionId
      );

      const correctedCode = answer.code;
      const patchDiff = answer.codeChanges?.[0]?.diff;
      const targetIdx = aiHistory.length + 1;

      setAiHistory((prev) => [
        ...prev,
        {
          role: "copilot",
          text: `Proposed Solution Patch Generated.\n\n${answer.explanation}\n\nKey Observations:\n${answer.approach?.join("\n") ?? ""}`,
          code: correctedCode,
          diff: patchDiff,
          patchStatus: correctedCode ? "proposed" : undefined,
        },
      ]);

      if (correctedCode) {
        setReviewingPatch({
          code: correctedCode,
          diff: patchDiff,
          messageIdx: targetIdx,
        });
      }

      await refreshBudget();
    } catch (err: unknown) {
      setAiHistory((prev) => [
        ...prev,
        {
          role: "copilot",
          text: `AI Request Blocked or Failed: ${err instanceof Error ? err.message : "Network error"}`,
        },
      ]);
    } finally {
      setIsAskingAI(false);
    }
  };

  // Send query to AI via gateway (Candidate reviewed; never auto-replaces editor code)
  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuestion.trim() || isAskingAI) return;

    if (budgetStatus.isExhausted) {
      alert("AI budget exhausted ($0.25 USD). Further AI queries are locked. You may continue writing code and testing your solution.");
      return;
    }

    const q = aiQuestion.trim();
    setAiQuestion("");
    setAiHistory((prev) => [...prev, { role: "candidate", text: q }]);
    setIsAskingAI(true);

    try {
      const answer = await ApiClient.generateAnswer(
        {
          task: "debug",
          question: q,
          code,
          language: "typescript",
          responseStyle: "concise",
          context: [],
        },
        "groq",
        sessionId
      );

      const correctedCode = answer.code;
      const patchDiff = answer.codeChanges?.[0]?.diff;

      setAiHistory((prev) => [
        ...prev,
        {
          role: "copilot",
          text: `${answer.explanation}\n\nKey Observations:\n${answer.approach?.join("\n") ?? ""}`,
          code: correctedCode,
          diff: patchDiff,
          patchStatus: correctedCode ? "proposed" : undefined,
        },
      ]);
      await refreshBudget();
    } catch (err: unknown) {
      setAiHistory((prev) => [
        ...prev,
        {
          role: "copilot",
          text: `AI Request Blocked or Failed: ${err instanceof Error ? err.message : "Network error"}`,
        },
      ]);
    } finally {
      setIsAskingAI(false);
    }
  };

  // Submit Final Assessment
  const handleSubmitAssessment = async () => {
    if (!explanation.trim()) {
      alert("Please provide a brief technical explanation before final submission.");
      return;
    }

    setIsSubmitting(true);
    try {
      // First ensure test results exist
      let tests = testResult?.tests ?? [];
      if (!testResult) {
        const val = await ApiClient.validateCode({
          language: "typescript",
          code,
          testCode: VERIFICATION_TESTS_CODE,
          timeoutMs: 4000,
          memoryLimitMb: 128,
        });
        tests = val.tests;
      }

      const diff = `--- a/src/useTicketQueue.ts\n+++ b/src/useTicketQueue.ts\n@@ -1,50 +1,50 @@\n${code}`;

      const card = await ApiClient.evaluateAssessment({
        sessionId,
        candidateId,
        finalCode: code,
        diff,
        explanation: explanation.trim(),
        testResults: tests,
        submittedAt: new Date(),
      });

      setScorecard(card);
      setIsSubmitModalOpen(false);
      setIsScorecardOpen(true);
    } catch (err: unknown) {
      alert(`Submission evaluation failed: ${err instanceof Error ? err.message : "Error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] w-screen bg-slate-100 overflow-hidden font-sans text-slate-800 dark:bg-[#090d16] dark:text-gray-100">
      {/* Top Assessment Control Header */}
      <div className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between shadow-xs transition-colors dark:border-gray-800 dark:bg-[#0d131f]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-900 dark:text-white">
              Frontend Engineer Challenge: Support Triage Queue
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300">
              Session Active
            </span>
          </div>
        </div>

        {/* Center / Right Metrics & Action Controls */}
        <div className="flex items-center gap-4 text-xs">
          {/* Timer Clock */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono font-bold transition-colors ${
              timeLeftSeconds < 300
                ? "bg-rose-50 text-rose-700 border-rose-300 animate-pulse dark:bg-rose-950/30 dark:text-rose-400"
                : timeLeftSeconds < 600
                ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400"
                : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
            }`}
          >
            <Clock className="w-4 h-4 text-indigo-500" />
            <span>{formatTimer(timeLeftSeconds)}</span>
          </div>

          {/* AI Usage Budget Meter */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 dark:border-gray-700 dark:bg-gray-800">
            <Coins className="w-3.5 h-3.5 text-amber-500" />
            <span>AI Budget:</span>
            <strong className="text-slate-800 dark:text-white">
              ${budgetStatus.consumedBudgetUsd.toFixed(3)}
            </strong>
            <span className="text-slate-400">/ $0.25</span>
            <div className="w-16 h-2 rounded-full bg-slate-200 overflow-hidden dark:bg-gray-700">
              <div
                className={`h-full transition-all ${
                  budgetStatus.isExhausted
                    ? "bg-rose-500"
                    : budgetStatus.isWarningTriggered
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, budgetStatus.percentUsed)}%` }}
              />
            </div>
          </div>

          {/* Verification runner button */}
          <button
            onClick={() => handleRunVerification()}
            disabled={isRunningTests}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors shadow-xs disabled:opacity-50"
          >
            {isRunningTests ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-white" />}
            <span>Run Tests</span>
          </button>

          {/* Final Submit Assessment button */}
          <button
            onClick={() => setIsSubmitModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Submit Solution</span>
          </button>
        </div>
      </div>

      {/* 80% Warning / Exhaustion Banner if active */}
      {budgetStatus.isWarningTriggered && !budgetStatus.isExhausted && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs text-amber-800 flex items-center justify-between dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Company Budget Notice:</strong> You have consumed over 80% (${budgetStatus.consumedBudgetUsd.toFixed(3)}) of your standard AI query allowance. Prioritize concise, targeted questions.
            </span>
          </div>
          <span className="font-semibold text-[11px]">80% Threshold</span>
        </div>
      )}

      {budgetStatus.isExhausted && (
        <div className="bg-rose-50 border-b border-rose-200 px-6 py-2 text-xs text-rose-800 flex items-center justify-between dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong>AI Query Limit Reached:</strong> Your session budget ($0.25 USD) is exhausted. AI assistance is locked. You can continue writing code, running verification tests, and submitting your solution without penalty.
            </span>
          </div>
          <span className="font-semibold text-[11px]">Hard Cutoff</span>
        </div>
      )}

      {/* Main Workspace Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane (Task Brief & AI Copilot Chat) */}
        <div className="w-1/2 border-r border-slate-200 bg-white flex flex-col overflow-hidden dark:border-gray-800 dark:bg-[#0c1017]">
          {/* Tab Bar */}
          <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold px-4 dark:border-gray-800 dark:bg-gray-900/50">
            <button
              onClick={() => setLeftTab("brief")}
              className={`px-4 py-3 border-b-2 transition-colors flex items-center gap-2 ${
                leftTab === "brief"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <FileCode className="w-4 h-4" />
              <span>Assessment Brief & Objectives</span>
            </button>
            <button
              onClick={() => setLeftTab("ai")}
              className={`px-4 py-3 border-b-2 transition-colors flex items-center gap-2 ${
                leftTab === "ai"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>AI Engineering Assistant</span>
              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-full dark:bg-indigo-950 dark:text-indigo-300">
                LPU
              </span>
            </button>
          </div>

          {/* Left Content Area */}
          <div className="flex-1 overflow-y-auto p-5 text-xs text-slate-700 space-y-4 dark:text-gray-300">
            {leftTab === "brief" && (
              <div className="space-y-4 leading-relaxed">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1 dark:text-white">
                    Scenario & Problem Overview
                  </h3>
                  <p className="text-slate-600 dark:text-gray-400">
                    You are maintaining the internal Customer Support Engineering dashboard. After a recent state refactor in <code className="bg-slate-100 dark:bg-gray-800 px-1 py-0.5 rounded font-mono text-indigo-600 dark:text-indigo-300">useTicketQueue.ts</code>, customer success reported two critical regressions in the triage list:
                  </p>
                </div>

                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 space-y-2 dark:border-rose-900/50 dark:bg-rose-950/20">
                  <h4 className="font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Reported Regressions:</span>
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-gray-300">
                    <li>
                      <strong>Priority Inversion:</strong> When sorted descending (<code className="font-mono">order: "desc"</code>), urgent incidents appear at the bottom instead of the top.
                    </li>
                    <li>
                      <strong>Array Mutation:</strong> Calling sort directly modifies the input tickets array in place, causing unpredictable re-renders.
                    </li>
                    <li>
                      <strong>Unhandled Empty Tags:</strong> Filtering by multi-tags throws exceptions when tickets omit the tags array.
                    </li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 dark:text-white">Your Objectives:</h4>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Fix priority order to strictly prioritize <strong>urgent</strong> &gt; <strong>high</strong> &gt; <strong>medium</strong> &gt; <strong>low</strong>.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Ensure pure, non-mutating array sorting using copied array spreads (<code className="font-mono">[...result].sort(...)</code>).</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Defensively guard optional ticket tags.</span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5 dark:border-gray-800 dark:bg-gray-900/40">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-gray-200">
                    <ShieldCheck className="w-4 h-4 text-indigo-500" />
                    <span>Rubric Dimensions Measured:</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400">
                    Code Comprehension (20%) • Problem Framing (10%) • AI Collaboration (15%) • Critical Evaluation (15%) • Debugging & Quality (20%) • Testing Discipline (15%) • Technical Explanation (5%).
                  </p>
                </div>
              </div>
            )}

            {leftTab === "ai" && (
              <div className="flex flex-col h-full space-y-3">
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {aiHistory.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl text-xs leading-relaxed ${
                        msg.role === "candidate"
                          ? "bg-indigo-600 text-white ml-8 shadow-xs"
                          : "bg-slate-100 text-slate-800 mr-4 border border-slate-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
                      }`}
                    >
                      <div className="font-semibold text-[10px] uppercase tracking-wider mb-1 opacity-70">
                        {msg.role === "candidate" ? "Candidate" : "AI Copilot"}
                      </div>
                      <div className="whitespace-pre-wrap font-sans">{msg.text}</div>

                      {/* If the AI provided code solution */}
                      {msg.code && (
                        <div className="mt-3 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900/90 overflow-hidden shadow-xs">
                          <div className="px-3 py-1.5 bg-slate-100 dark:bg-gray-800/90 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between text-[11px]">
                            <span className="font-mono font-medium text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                              <FileCode className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Proposed Solution Patch</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              {msg.patchStatus === "accepted" ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>✓ Accepted & Applied</span>
                                </span>
                              ) : msg.patchStatus === "rejected" ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 flex items-center gap-1">
                                  <XCircle className="w-3 h-3 text-rose-600" />
                                  <span>✕ Rejected</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                  Pending Review
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="p-3 bg-slate-50 dark:bg-gray-950/60 space-y-2">
                            <pre className="font-mono text-[11px] leading-relaxed overflow-x-auto max-h-32 text-slate-800 dark:text-gray-200">
                              <code>{msg.code}</code>
                            </pre>

                            <div className="pt-2 border-t border-slate-200 dark:border-gray-800 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() =>
                                  setReviewingPatch({
                                    code: msg.code!,
                                    diff: msg.diff,
                                    messageIdx: idx,
                                  })
                                }
                                className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] flex items-center gap-1 shadow-xs transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Inspect & Review Patch</span>
                              </button>

                              {msg.patchStatus !== "accepted" && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleRejectPatch(idx)}
                                    className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-200 text-slate-700 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 text-[11px] transition-colors"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAcceptPatch(msg.code!, idx)}
                                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] transition-colors"
                                  >
                                    Accept
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {isAskingAI && (
                    <div className="p-3 rounded-xl bg-slate-100 text-slate-600 text-xs flex items-center gap-2 dark:bg-gray-800 dark:text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                      <span>Querying Groq LPU Gateway...</span>
                    </div>
                  )}
                </div>

                {/* Input prompt */}
                <form onSubmit={handleAskAI} className="pt-2 border-t border-slate-200 dark:border-gray-800 flex gap-2">
                  <input
                    type="text"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    disabled={isAskingAI || budgetStatus.isExhausted}
                    placeholder={
                      budgetStatus.isExhausted
                        ? "AI Quota Exhausted"
                        : "Ask AI for explanation, edge cases, or code proposals..."
                    }
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={isAskingAI || !aiQuestion.trim() || budgetStatus.isExhausted}
                    className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane (Code Editor & Verification Runner) */}
        <div className="w-1/2 flex flex-col bg-[#0d121c] overflow-hidden text-gray-100">
          {/* Top Editor Toolbar */}
          <div className="h-10 border-b border-slate-800 bg-slate-900/90 px-4 flex items-center justify-between text-xs">
            <span className="font-mono text-indigo-400 font-semibold flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5" />
              <span>src/useTicketQueue.ts</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRequestSolutionProposal}
                disabled={isAskingAI || budgetStatus.isExhausted}
                className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors flex items-center gap-1 text-[11px] shadow-xs disabled:opacity-50"
                title="Ask AI for a solution proposal to inspect and review"
              >
                <Sparkles className="w-3 h-3" />
                <span>Propose Solution with AI</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (confirm("Reset code back to original starter code?")) {
                    setCode(STARTER_CODE);
                    setAppliedNotice("Starter code restored.");
                    setTimeout(() => setAppliedNotice(null), 3000);
                  }
                }}
                className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-[11px]"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Starter</span>
              </button>
            </div>
          </div>

          {/* Applied Code Notice Banner */}
          {appliedNotice && (
            <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-4 py-1.5 text-xs text-emerald-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{appliedNotice}</span>
              </span>
              <button
                type="button"
                onClick={() => handleRunVerification()}
                className="text-[11px] underline hover:text-emerald-300 font-semibold"
              >
                Run Tests
              </button>
            </div>
          )}

          {/* Code Editor Area */}
          <div className="flex-1 overflow-hidden p-2">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="w-full h-full bg-[#090d16] p-4 font-mono text-xs text-gray-100 resize-none focus:outline-none border border-slate-800 rounded-lg leading-relaxed selection:bg-indigo-600"
            />
          </div>

          {/* Bottom Test Results Bar */}
          <div className="h-44 border-t border-slate-800 bg-[#0c1017] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 text-xs">
              <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>Isolated Sandbox Verification Test Suite</span>
              </span>

              {testResult && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    testResult.passed ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                  }`}
                >
                  {testResult.passed
                    ? "5/5 TESTS PASSED"
                    : `${testResult.tests.filter((t) => t.passed).length}/${testResult.tests.length || 5} PASSED`}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
              {!testResult && (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-1">
                  <span>Click "Run Tests" in top bar to execute code against unit tests.</span>
                </div>
              )}

              {testResult && (
                <div className="space-y-1.5">
                  {testResult.tests.map((t, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-1.5 rounded bg-slate-900/60 border border-slate-800/80 font-mono text-[11px]"
                    >
                      <div className="flex items-center gap-2">
                        {t.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                        <span className={t.passed ? "text-gray-200" : "text-rose-300"}>{t.name}</span>
                      </div>
                      <span className="text-gray-500">{t.durationMs}ms</span>
                    </div>
                  ))}

                  {testResult.stderr && (
                    <div className="p-2 rounded bg-rose-950/40 border border-rose-900 font-mono text-[11px] text-rose-300 whitespace-pre-wrap">
                      {testResult.stderr}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Proposed Solution Patch Review Inspector Modal (Decision #7) */}
      {reviewingPatch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#111827] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Review Proposed Solution Patch
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Untrusted AI output. Review the proposed modifications before explicitly accepting or rejecting.
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-semibold border border-amber-300 dark:border-amber-700">
                Decision Required
              </span>
            </div>

            {/* Modal Body - Code Diff / Code Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {reviewingPatch.diff && (
                <div>
                  <div className="font-semibold text-slate-800 dark:text-gray-200 mb-1.5 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Proposed Patch Unified Diff:</span>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-950 font-mono text-[11px] text-slate-200 overflow-x-auto leading-relaxed border border-slate-800 max-h-48">
                    {reviewingPatch.diff}
                  </pre>
                </div>
              )}

              <div>
                <div className="font-semibold text-slate-800 dark:text-gray-200 mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Complete Proposed Implementation:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(reviewingPatch.code);
                      setAppliedNotice("Proposed patch code copied to clipboard.");
                      setTimeout(() => setAppliedNotice(null), 3000);
                    }}
                    className="text-[11px] text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Code</span>
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-[#090d16] font-mono text-[11px] text-slate-200 overflow-x-auto leading-relaxed border border-slate-800 max-h-72">
                  <code>{reviewingPatch.code}</code>
                </pre>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 dark:bg-gray-900/60 dark:border-gray-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleRejectPatch(reviewingPatch.messageIdx)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 flex items-center gap-1.5 transition-colors"
              >
                <XCircle className="w-4 h-4 text-rose-500" />
                <span>Reject Patch (Keep Current Code)</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setReviewingPatch(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white"
                >
                  Close & Decide Later
                </button>

                <button
                  type="button"
                  onClick={() => handleAcceptPatch(reviewingPatch.code, reviewingPatch.messageIdx)}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4 fill-white text-emerald-600" />
                  <span>Accept & Apply Patch to Editor</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Final Submission Dialog */}
      {isSubmitModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-gray-800 dark:bg-[#111827]">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Submit Solution for Interviewer Evaluation
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Provide a structured technical explanation. Your response directly feeds the Problem Framing and Technical Explanation rubric dimensions.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300">
                Root Cause Analysis & Verification Approach:
              </label>
              <textarea
                rows={6}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="1. Root cause identified in priority comparator...&#10;2. Fix implemented to prevent in-place array mutation...&#10;3. Verified all 5 test cases pass cleanly..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-gray-800">
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
              >
                Back to Workspace
              </button>

              <button
                onClick={handleSubmitAssessment}
                disabled={isSubmitting || !explanation.trim()}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-colors"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Generate Official Scorecard</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reviewer Scorecard Modal */}
      <ScorecardModal
        scorecard={scorecard}
        isOpen={isScorecardOpen}
        onClose={() => setIsScorecardOpen(false)}
      />
    </div>
  );
};
