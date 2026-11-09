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
  LogOut,
  Award,
  Hash,
  Layers,
  Bot,
  Shield,
  Lock,
  FileText,
  CheckSquare,
  HelpCircle,
  ArrowRight,
  FolderTree,
  BookOpen,
} from "lucide-react";
import { ApiClient } from "../services/apiClient.js";
import { ScorecardModal } from "./ScorecardModal.js";
import { TelemetryClient } from "../services/telemetryClient.js";
import type {
  SessionBudgetStatus,
  AIResponse,
  CodeValidationResponse,
  AssessmentScorecard,
  AcceptInvitationResponse,
  AssessmentSessionStatus,
  SubmitAssessmentResponse,
  AssessmentTask,
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

interface AssessmentWorkspaceProps {
  sessionData?: AcceptInvitationResponse | null;
  onExitSession?: () => void;
}

export const AssessmentWorkspace: React.FC<AssessmentWorkspaceProps> = ({
  sessionData,
  onExitSession,
}) => {
  const [sessionId, setSessionId] = useState<string>(
    () => sessionData?.sessionId || `sess_${Date.now().toString(36)}`
  );
  const [candidateId] = useState(
    () => sessionData?.invitation.candidateName || "cand_frontend_pilot_1"
  );
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(
    () => (sessionData?.durationMinutes ?? 60) * 60
  );
  const [code, setCode] = useState(() => sessionData?.starterCode || STARTER_CODE);
  const verificationTestCode = sessionData?.verificationTestCode || VERIFICATION_TESTS_CODE;
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  // LOOP 6: Multi-Task Architecture
  const [tasks] = useState<AssessmentTask[]>(() => {
    if (sessionData?.tasks && sessionData.tasks.length > 0) {
      return sessionData.tasks;
    }
    return [
      {
        id: "task_triage_queue",
        type: "coding_challenge",
        title: "Section 1: Support Triage Queue Bugfix",
        description:
          "Investigate and resolve priority sorting inversion, array mutation side-effects, and undefined tag filtering crashes.",
        order: 0,
        weight: 100,
        aiPolicy: {
          enabled: true,
          mode: "full_copilot",
          allowedModel: "gpt-4o-mini",
          maxBudgetUsd: sessionData?.toolPolicy?.maxBudgetUsd ?? 0.25,
          candidateDisclosure:
            "Full AI Copilot enabled with proposed code patch reviews.",
        },
        config: {
          starterCode: sessionData?.starterCode || STARTER_CODE,
          verificationTestCode:
            sessionData?.verificationTestCode || VERIFICATION_TESTS_CODE,
          language: "typescript",
        },
      },
    ];
  });
  const [activeTaskIndex, setActiveTaskIndex] = useState(0);
  const activeTask: AssessmentTask = tasks[activeTaskIndex] || tasks[0] || {
    id: "task_triage_queue",
    type: "coding_challenge",
    title: "Section 1: Support Triage Queue Bugfix",
    description: "Investigate and resolve priority sorting inversion and array mutation side-effects.",
    order: 0,
    weight: 100,
    aiPolicy: {
      enabled: true,
      mode: "full_copilot",
      allowedModel: "gpt-4o-mini",
      maxBudgetUsd: sessionData?.toolPolicy?.maxBudgetUsd ?? 0.25,
      candidateDisclosure: "Full AI Copilot enabled with proposed code patch reviews.",
    },
    config: {
      starterCode: sessionData?.starterCode || STARTER_CODE,
      verificationTestCode: sessionData?.verificationTestCode || VERIFICATION_TESTS_CODE,
      language: "typescript",
    },
  };
  const [questionAnswers, setQuestionAnswers] = useState<
    Record<string, { selectedOptionIds?: string[]; textResponse?: string; selectedOptionIndexes?: number[] }>
  >({});

  // Multi-task Code Buffers
  const [taskCodes, setTaskCodes] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const t of tasks) {
      if (t.type === "coding_challenge") {
        map[t.id] = t.config?.starterCode || sessionData?.starterCode || STARTER_CODE;
      }
    }
    return map;
  });

  // Virtual Files for Multi-File Repository Tasks
  const [repoFiles, setRepoFiles] = useState<Record<string, { content: string; isReadOnly?: boolean }>>(() => {
    const initialFiles: Record<string, { content: string; isReadOnly?: boolean }> = {};
    for (const t of tasks) {
      if (t.type === "repository_task") {
        if (t.config?.fileTree && Array.isArray(t.config.fileTree)) {
          for (const f of t.config.fileTree) {
            initialFiles[f.path] = { content: f.content, isReadOnly: f.isReadOnly };
          }
        } else if (t.config?.starterFiles) {
          for (const [p, content] of Object.entries(t.config.starterFiles)) {
            initialFiles[p] = { content: content as string, isReadOnly: false };
          }
        }
      }
    }
    if (Object.keys(initialFiles).length === 0) {
      initialFiles["src/index.ts"] = {
        content: `export function processEvents(events: any[]) {\n  // Implementation here\n  return events;\n}`,
        isReadOnly: false,
      };
      initialFiles["src/types.ts"] = {
        content: `export interface SystemEvent {\n  id: string;\n  timestamp: number;\n  type: string;\n}`,
        isReadOnly: true,
      };
    }
    return initialFiles;
  });

  const [activeRepoFilePath, setActiveRepoFilePath] = useState<string>(() => {
    const repoTask = tasks.find((t) => t.type === "repository_task");
    if (repoTask?.config?.primaryFileToEdit) return repoTask.config.primaryFileToEdit;
    if (repoTask?.config?.fileTree?.[0]?.path) return repoTask.config.fileTree[0].path;
    return "src/index.ts";
  });

  // Task Switcher with Code Buffer Persistence
  const handleSwitchTask = (newIdx: number) => {
    if (newIdx === activeTaskIndex) return;
    if (activeTask.type === "coding_challenge") {
      setTaskCodes((prev) => ({ ...prev, [activeTask.id]: code }));
    }
    setActiveTaskIndex(newIdx);
    const nextTask = tasks[newIdx];
    if (nextTask && nextTask.type === "coding_challenge") {
      const nextCode = taskCodes[nextTask.id] || nextTask.config?.starterCode || sessionData?.starterCode || STARTER_CODE;
      setCode(nextCode);
    }
  };

  // Question Set Answer Handlers
  const handleSelectOption = (questionId: string, optionIdOrIndex: string | number, isMulti: boolean) => {
    setQuestionAnswers((prev) => {
      const existing = prev[questionId] || {};
      const currentIds = existing.selectedOptionIds || [];
      const currentIdxs = existing.selectedOptionIndexes || [];
      const idStr = String(optionIdOrIndex);
      const idxNum = typeof optionIdOrIndex === "number" ? optionIdOrIndex : parseInt(optionIdOrIndex, 10);

      if (isMulti) {
        const nextIds = currentIds.includes(idStr)
          ? currentIds.filter((id) => id !== idStr)
          : [...currentIds, idStr];
        const nextIdxs = !isNaN(idxNum)
          ? currentIdxs.includes(idxNum)
            ? currentIdxs.filter((i) => i !== idxNum)
            : [...currentIdxs, idxNum]
          : currentIdxs;
        return {
          ...prev,
          [questionId]: {
            ...existing,
            selectedOptionIds: nextIds,
            selectedOptionIndexes: nextIdxs,
          },
        };
      } else {
        return {
          ...prev,
          [questionId]: {
            ...existing,
            selectedOptionIds: [idStr],
            selectedOptionIndexes: !isNaN(idxNum) ? [idxNum] : [],
          },
        };
      }
    });
  };

  const handleUpdateTextResponse = (questionId: string, text: string) => {
    setQuestionAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        textResponse: text,
      },
    }));
  };

  // Server-Authoritative Session Lifecycle State
  const [sessionStatus, setSessionStatus] = useState<AssessmentSessionStatus>("in_progress");
  const [inGracePeriod, setInGracePeriod] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  // Autosave State
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const lastSavedCodeRef = useRef<string>(sessionData?.starterCode || STARTER_CODE);

  // Proposed Patch Review Modal State (Architectural Decision #7)
  const [reviewingPatch, setReviewingPatch] = useState<{
    code: string;
    diff?: string | undefined;
    messageIdx?: number | undefined;
  } | null>(null);

  // Budget state
  const [budgetStatus, setBudgetStatus] = useState<SessionBudgetStatus>({
    maxBudgetUsd: sessionData?.toolPolicy?.maxBudgetUsd ?? 0.25,
    consumedBudgetUsd: 0,
    remainingBudgetUsd: sessionData?.toolPolicy?.maxBudgetUsd ?? 0.25,
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

  // Submission & Cryptographic Receipt State (Task 14)
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionReceipt, setSubmissionReceipt] = useState<SubmitAssessmentResponse | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [copiedReceiptFp, setCopiedReceiptFp] = useState(false);
  const [scorecard, setScorecard] = useState<AssessmentScorecard | null>(null);
  const [isScorecardOpen, setIsScorecardOpen] = useState(false);

  // Proctor Incident & Pause Controls (Task 15)
  const [isPaused, setIsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<string | null>(null);

  // Poll / Refresh budget helper
  const refreshBudget = async () => {
    try {
      const hb = await ApiClient.getSessionHeartbeat(sessionId);
      setBudgetStatus((prev) => ({
        ...prev,
        consumedBudgetUsd: hb.consumedBudgetUsd,
        remainingBudgetUsd: hb.remainingBudgetUsd,
        isWarningTriggered: hb.budgetWarning,
        isExhausted: hb.remainingBudgetUsd <= 0,
        percentUsed: Math.min(100, (hb.consumedBudgetUsd / (prev.maxBudgetUsd || 0.25)) * 100),
      }));
    } catch {
      // Ignored
    }
  };

  // Bootstrap backend session in dev mode if not launched via invite
  useEffect(() => {
    if (sessionData) return;

    let isMounted = true;
    const bootstrapDevSession = async () => {
      try {
        const { organizations } = await ApiClient.getOrganizations();
        const orgId = organizations?.[0]?.id;
        if (!orgId) return;

        const { templates } = await ApiClient.getTemplates(orgId);
        const templateId = templates?.[0]?.id;
        if (!templateId) return;

        const session = await ApiClient.createSession({
          organizationId: orgId,
          templateId,
          candidateEmail: "candidate@demo.acme",
          candidateName: "Alex Mercer",
          durationMinutes: 60,
        });

        if (isMounted) {
          setSessionId(session.id);
          telemetryRef.current?.updateSession(session.id);
        }
      } catch (err) {
        console.warn("Dev session bootstrap skipped:", err);
      }
    };

    bootstrapDevSession();
    return () => {
      isMounted = false;
    };
  }, [sessionData]);

  // Telemetry event logging client
  const telemetryRef = useRef<TelemetryClient | null>(null);

  useEffect(() => {
    const client = new TelemetryClient(sessionId, sessionData?.candidateToken);
    telemetryRef.current = client;

    client.record(
      "session_started",
      {
        candidateId,
        sessionId,
        durationMinutes: sessionData?.durationMinutes ?? 60,
        starterCodeLength: code.length,
      },
      true
    );

    let blurStart = 0;
    const handleBlur = () => {
      blurStart = Date.now();
      client.record("window_blur", { timestamp: blurStart });
    };

    const handleFocus = () => {
      const now = Date.now();
      const offScreenMs = blurStart > 0 ? now - blurStart : 0;
      blurStart = 0;
      client.record("window_focus", {
        timestamp: now,
        durationMs: offScreenMs,
        offScreenDurationMs: offScreenMs,
      });
    };

    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text") || "";
      if (text.length > 20) {
        client.record("paste_detected", {
          length: text.length,
          charactersInserted: text.length,
          characterCount: text.length,
          isFromCopilotPatch: false,
          snippet: text.slice(0, 40),
        });
      }
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("paste", handlePaste);
      client.destroy();
    };
  }, [sessionId, sessionData?.candidateToken]);

  // Smooth local countdown timer (frozen when paused by proctor)
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => (!isPaused && prev > 0 ? prev - 1 : prev));
    }, 1000);
    return () => clearInterval(timer);
  }, [isPaused]);

  // Task 15: Automatic Crash Recovery from last autosaved snapshot on reload/reconnect
  useEffect(() => {
    let isMounted = true;
    const recoverSessionSnapshot = async () => {
      try {
        const sess = await ApiClient.getSession(sessionId, sessionData?.candidateToken);
        if (!isMounted) return;
        if (sess?.workspaceSnapshot?.currentCode && sess.workspaceSnapshot.currentCode.trim().length > 0) {
          setCode(sess.workspaceSnapshot.currentCode);
          lastSavedCodeRef.current = sess.workspaceSnapshot.currentCode;
          if (sess.workspaceSnapshot.lastSavedAt) {
            setLastSavedAt(new Date(sess.workspaceSnapshot.lastSavedAt));
          }
        }
      } catch {
        // Fallback to starter code
      }
    };
    recoverSessionSnapshot();
    return () => {
      isMounted = false;
    };
  }, [sessionId, sessionData?.candidateToken]);

  // Server-authoritative heartbeat every 5 seconds
  useEffect(() => {
    let isMounted = true;

    const pollHeartbeat = async () => {
      try {
        const hb = await ApiClient.getSessionHeartbeat(sessionId);
        if (!isMounted) return;

        setTimeLeftSeconds(hb.remainingSeconds);
        setIsExpired(hb.isExpired);
        setInGracePeriod(hb.inGracePeriod);
        setIsPaused(Boolean(hb.isPaused || hb.status === "paused"));
        setPauseReason(hb.pauseReason || null);
        setSessionStatus(hb.status);

        setBudgetStatus((prev) => ({
          ...prev,
          consumedBudgetUsd: hb.consumedBudgetUsd,
          remainingBudgetUsd: hb.remainingBudgetUsd,
          isWarningTriggered: hb.budgetWarning,
          isExhausted: hb.remainingBudgetUsd <= 0,
          percentUsed: Math.min(100, (hb.consumedBudgetUsd / (prev.maxBudgetUsd || 0.25)) * 100),
        }));
      } catch {
        // Dev offline or session not yet created on backend
      }
    };

    pollHeartbeat();
    const interval = setInterval(pollHeartbeat, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [sessionId]);

  // Autosave workspace code to backend
  const performAutosave = async (
    currentCode: string,
    testResults?: CodeValidationResponse["tests"]
  ) => {
    if (sessionStatus === "submitted" || (isExpired && !inGracePeriod)) return;
    try {
      setIsAutosaving(true);
      const res = await ApiClient.autosaveWorkspace(sessionId, {
        code: currentCode,
        testResults,
      });
      setLastSavedAt(new Date(res.lastSavedAt));
      lastSavedCodeRef.current = currentCode;

      // Telemetry record
      telemetryRef.current?.record("code_snapshot", {
        codeLength: currentCode.length,
        lines: currentCode.split("\n").length,
      });
    } catch {
      // Ignored for transient glitches
    } finally {
      setIsAutosaving(false);
    }
  };

  // 20-second background autosave interval
  useEffect(() => {
    const autosaveInterval = setInterval(() => {
      if (code !== lastSavedCodeRef.current) {
        performAutosave(code, testResult?.tests);
      }
    }, 20000);
    return () => clearInterval(autosaveInterval);
  }, [code, sessionId, sessionStatus, isExpired, inGracePeriod, testResult]);

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
        testCode: verificationTestCode,
        timeoutMs: 4000,
        memoryLimitMb: 128,
      });
      setTestResult(result);
      performAutosave(targetCode, result.tests);

      const passedCount = result.tests.filter((t) => t.passed).length;
      const totalCount = result.tests.length;

      telemetryRef.current?.record(
        "test_run",
        {
          passedCount,
          totalCount,
          passed: result.passed,
          durationMs: result.durationMs,
        },
        true
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isExecutionDisabled =
        msg.includes("RUNNER_EXECUTION_DISABLED") ||
        msg.includes("Untrusted candidate code execution is disabled");

      setTestResult({
        success: false,
        passed: false,
        exitCode: 1,
        stdout: isExecutionDisabled
          ? "[SECURITY NOTICE] Untrusted candidate code execution is disabled pending verified Linux gVisor sandbox worker deployment."
          : "",
        stderr: isExecutionDisabled
          ? "Code execution is disabled by policy for this pilot session. Your code changes, virtual repository edits, and written explanations are safely saved for human reviewer evaluation."
          : err instanceof Error
            ? err.message
            : "Validation failure",
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

    telemetryRef.current?.record(
      "ai_patch_decision",
      { decision: "accepted", messageIdx },
      true
    );

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

    telemetryRef.current?.record(
      "ai_patch_decision",
      { decision: "rejected", messageIdx },
      true
    );

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
    if (activeTask.aiPolicy?.mode === "prohibited") {
      alert(activeTask.aiPolicy.candidateDisclosure || "AI assistance is strictly prohibited for this section by company policy.");
      return;
    }
    if (activeTask.aiPolicy?.mode === "restricted_explainer") {
      alert("AI Explainer Mode: AI can explain architectural trade-offs, but code generation is disabled for this section.");
      return;
    }

    setLeftTab("ai");
    const promptText = `Please propose a minimal bugfix or implementation patch for ${activeTask.title}.`;
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
          context: [{ content: activeTask.description, source: "user" }],
        },
        undefined,
        sessionId
      );

      const correctedCode = answer.code;
      const patchDiff = answer.codeChanges?.[0]?.diff;
      const targetIdx = aiHistory.length + 1;

      telemetryRef.current?.record("ai_patch_proposed", {
        patchDiffLength: patchDiff?.length ?? 0,
        proposedCodeLength: correctedCode?.length ?? 0,
      });

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

    if (activeTask.aiPolicy?.mode === "prohibited") {
      alert(activeTask.aiPolicy.candidateDisclosure || "AI assistance is prohibited by company policy for this section.");
      return;
    }

    if (budgetStatus.isExhausted) {
      alert("AI budget exhausted ($0.25 USD). Further AI queries are locked. You may continue writing code and testing your solution.");
      return;
    }

    const q = aiQuestion.trim();
    setAiQuestion("");
    setAiHistory((prev) => [...prev, { role: "candidate", text: q }]);
    setIsAskingAI(true);

    telemetryRef.current?.record(
      "ai_query",
      { question: q, codeLength: code.length },
      true
    );

    try {
      const answer = await ApiClient.generateAnswer(
        {
          task: "debug",
          question: q,
          code,
          language: "typescript",
          responseStyle: "concise",
          context: [{ content: activeTask.description, source: "user" }],
        },
        undefined,
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
      // First ensure test results exist (or proceed safely if execution is disabled)
      let tests = testResult?.tests ?? [];
      if (!testResult) {
        try {
          const val = await ApiClient.validateCode({
            language: "typescript",
            code,
            testCode: verificationTestCode,
            timeoutMs: 4000,
            memoryLimitMb: 128,
          });
          tests = val.tests;
        } catch {
          // If execution is disabled or runner unreachable, proceed with empty test results for human review
          tests = [];
        }
      }

      // Assemble structured multi-task submissions (LOOP 6)
      const taskSubmissions: Record<string, any> = {};
      for (const t of tasks) {
        if (t.type === "question_set") {
          taskSubmissions[t.id] = {
            taskId: t.id,
            taskType: "question_set",
            status: "completed",
            answers: questionAnswers,
            maxPoints: t.weight ?? t.points ?? 30,
          };
        } else if (t.type === "coding_challenge") {
          taskSubmissions[t.id] = {
            taskId: t.id,
            taskType: "coding_challenge",
            status: "completed",
            codeSubmission: {
              code: taskCodes[t.id] || code,
              language: t.config?.language || "typescript",
            },
            maxPoints: t.weight ?? t.points ?? 70,
          };
        } else if (t.type === "repository_task") {
          const filesRecord: Record<string, string> = {};
          for (const [p, f] of Object.entries(repoFiles)) {
            filesRecord[p] = f.content;
          }
          taskSubmissions[t.id] = {
            taskId: t.id,
            taskType: "repository_task",
            status: "completed",
            finalFiles: filesRecord,
            codeSubmission: {
              code: repoFiles[t.config?.primaryFileToEdit || "src/index.ts"]?.content || code,
              language: t.config?.targetLanguage || "typescript",
            },
            maxPoints: t.weight ?? t.points ?? 40,
          };
        }
      }

      // Submit to server-authoritative session record with immutable artifact bundling (Task 14)
      try {
        const receipt = await ApiClient.submitAssessment(
          sessionId,
          {
            finalCode: code,
            technicalExplanation: explanation.trim(),
            taskSubmissions,
          },
          sessionData?.candidateToken
        );
        setSubmissionReceipt(receipt);
        setIsReceiptModalOpen(true);
      } catch (err) {
        console.warn("Server session submit warning:", err);
      }

      telemetryRef.current?.record(
        "session_submitted",
        {
          finalCodeLength: code.length,
          explanationLength: explanation.length,
          testsPassed: tests.filter((t) => t.passed).length,
          totalTests: tests.length,
        },
        true
      );
      telemetryRef.current?.flush();

      const diff = `--- a/src/useTicketQueue.ts\n+++ b/src/useTicketQueue.ts\n@@ -1,50 +1,50 @@\n${code}`;

      try {
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
      } catch (cardErr) {
        console.warn("Scorecard evaluation notice:", cardErr);
      }

      setSessionStatus("submitted");
      setIsSubmitModalOpen(false);
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
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${sessionStatus === "submitted"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : isPaused
                    ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 animate-pulse"
                    : inGracePeriod
                      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300"
                      : isExpired
                        ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300"
                        : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300"
                }`}
            >
              {sessionStatus === "submitted"
                ? "Submitted"
                : isPaused
                  ? "Session Paused"
                  : inGracePeriod
                    ? "Grace Period Active"
                    : isExpired
                      ? "Time Expired"
                      : "Session Active"}
            </span>
          </div>

          {sessionData && (
            <span className="text-xs text-slate-500 border-l border-slate-200 pl-3 dark:border-gray-700 dark:text-gray-400">
              Candidate:{" "}
              <strong className="text-slate-700 dark:text-gray-200">
                {sessionData.invitation.candidateName}
              </strong>
            </span>
          )}
        </div>

        {/* Center / Right Metrics & Action Controls */}
        <div className="flex items-center gap-4 text-xs">
          {/* Autosave Status Indicator */}
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-gray-400">
            <span
              className={`w-2 h-2 rounded-full ${isAutosaving
                  ? "bg-amber-500 animate-ping"
                  : lastSavedAt
                    ? "bg-emerald-500"
                    : "bg-slate-400"
                }`}
            />
            <span className="text-[11px]">
              {isAutosaving
                ? "Autosaving..."
                : lastSavedAt
                  ? `Saved ${lastSavedAt.toLocaleTimeString()}`
                  : "Autosave ready"}
            </span>
          </div>

          {/* Timer Clock */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono font-bold transition-colors ${inGracePeriod
                ? "bg-amber-50 text-amber-700 border-amber-300 animate-pulse dark:bg-amber-950/30 dark:text-amber-400"
                : isExpired
                  ? "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/30 dark:text-rose-400"
                  : timeLeftSeconds < 300
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
            <span className="text-slate-400">/ ${budgetStatus.maxBudgetUsd.toFixed(2)}</span>
            <div className="w-16 h-2 rounded-full bg-slate-200 overflow-hidden dark:bg-gray-700">
              <div
                className={`h-full transition-all ${budgetStatus.isExhausted
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
            disabled={isRunningTests || isPaused}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors shadow-xs disabled:opacity-50"
          >
            {isRunningTests ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-white" />
            )}
            <span>Run Tests</span>
          </button>

          {/* Final Submit Assessment button */}
          {sessionStatus === "submitted" ? (
            <button
              onClick={() => setIsReceiptModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 font-semibold text-xs transition-colors shadow-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Receipt (SHA-256)</span>
            </button>
          ) : (
            <button
              onClick={() => setIsSubmitModalOpen(true)}
              disabled={isExpired && !inGracePeriod}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Submit Solution</span>
            </button>
          )}

          {/* Optional Exit Button */}
          {onExitSession && (
            <button
              onClick={onExitSession}
              title="Exit Assessment Workspace"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-600 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 text-xs transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          )}
        </div>
      </div>

      {/* Task 15: Proctor Incident Paused Banner */}
      {isPaused && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-6 py-2.5 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
            <span className="font-bold">⚠️ Assessment Session Paused by Proctor:</span>
            <span className="text-amber-700 dark:text-amber-300">
              {pauseReason || "Timer and workspace are temporarily frozen. All work is safely autosaved."}
            </span>
          </div>
          <span className="font-mono text-[11px] bg-amber-500/20 px-2 py-0.5 rounded font-bold text-amber-800 dark:text-amber-300">
            TIMER FROZEN • WORKSPACE LOCKED
          </span>
        </div>
      )}

      {/* Grace Period Active Banner */}
      {inGracePeriod && (
        <div className="bg-amber-50 border-b border-amber-300 px-6 py-2.5 flex items-center justify-between text-amber-900 text-xs dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
            <span>
              <strong>Grace Period Active:</strong> Standard duration elapsed. You have 60 seconds
              to finalize and submit in-flight changes. AI generation is locked.
            </span>
          </div>
          <button
            onClick={() => setIsSubmitModalOpen(true)}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded shadow-xs text-xs"
          >
            Submit Solution Now
          </button>
        </div>
      )}

      {/* Hard Expiration Cutoff Banner */}
      {isExpired && !inGracePeriod && sessionStatus !== "submitted" && (
        <div className="bg-rose-50 border-b border-rose-300 px-6 py-2.5 flex items-center justify-between text-rose-900 text-xs dark:bg-rose-950/40 dark:border-rose-700 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong>Assessment Window Closed:</strong> Time limit has expired. Editor is locked to
              preserve evaluation integrity.
            </span>
          </div>
          <button
            onClick={() => setIsSubmitModalOpen(true)}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded shadow-xs text-xs"
          >
            Submit Final Attempt
          </button>
        </div>
      )}

      {/* Submitted Confirmation Banner */}
      {sessionStatus === "submitted" && (
        <div className="bg-emerald-50 border-b border-emerald-300 px-6 py-2.5 flex items-center justify-between text-emerald-900 text-xs dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Assessment Submitted:</strong> Solution submitted successfully. Official
              scorecard generated with human-in-the-loop calibration.
            </span>
          </div>
          <div className="flex items-center gap-2">
            {scorecard && (
              <button
                onClick={() => setIsScorecardOpen(true)}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded shadow-xs text-xs flex items-center gap-1"
              >
                <Award className="w-3.5 h-3.5" />
                <span>View Scorecard</span>
              </button>
            )}
            {onExitSession && (
              <button
                onClick={onExitSession}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded shadow-xs text-xs flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Exit Assessment</span>
              </button>
            )}
          </div>
        </div>
      )}

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

      {/* LOOP 6: Multi-Task Stepper Navigation */}
      {tasks.length > 1 && (
        <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between dark:bg-[#0d131f] dark:border-gray-800 text-xs shadow-xs">
          <div className="flex items-center gap-2 overflow-x-auto py-0.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Sections:
            </span>
            {tasks.map((t, idx) => {
              const isActive = activeTaskIndex === idx;
              return (
                <button
                  key={t.id}
                  onClick={() => handleSwitchTask(idx)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-700"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-300 dark:bg-gray-700 text-slate-700 dark:text-gray-300"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="line-clamp-1 max-w-[180px]">{t.title}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 dark:bg-gray-700 text-slate-600 dark:text-gray-400"
                    }`}
                  >
                    {t.weight ?? t.points ?? 25} pts
                  </span>
                </button>
              );
            })}
          </div>

          {/* Current Section Policy Badge */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-slate-400">Section AI Policy:</span>
            <span
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold border flex items-center gap-1.5 ${
                activeTask.aiPolicy?.mode === "prohibited"
                  ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300"
                  : activeTask.aiPolicy?.mode === "restricted_explainer"
                  ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
              }`}
            >
              {activeTask.aiPolicy?.mode === "prohibited" ? (
                <>
                  <Shield className="w-3 h-3 text-rose-600" />
                  <span>AI Assistance Prohibited</span>
                </>
              ) : activeTask.aiPolicy?.mode === "restricted_explainer" ? (
                <>
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  <span>AI Explainer Only</span>
                </>
              ) : (
                <>
                  <Bot className="w-3 h-3 text-emerald-600" />
                  <span>Full AI Copilot ($0.25)</span>
                </>
              )}
            </span>
          </div>
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
              className={`px-4 py-3 border-b-2 transition-colors flex items-center gap-2 ${leftTab === "brief"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white"
                }`}
            >
              <FileCode className="w-4 h-4" />
              <span>Assessment Brief & Objectives</span>
            </button>
            <button
              onClick={() => setLeftTab("ai")}
              className={`px-4 py-3 border-b-2 transition-colors flex items-center gap-2 ${leftTab === "ai"
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
              activeTask.type === "question_set" ? (
                <div className="space-y-6 leading-relaxed">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        Task Family: Technical Questions
                      </span>
                      <span className="text-slate-400 text-xs">
                        {activeTask.config?.questions?.length || 0} Questions
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {activeTask.title}
                    </h3>
                    <p className="text-slate-600 dark:text-gray-400 mt-1">
                      {activeTask.description}
                    </p>
                  </div>

                  {/* List of Questions */}
                  <div className="space-y-5">
                    {(!activeTask.config?.questions || activeTask.config.questions.length === 0) ? (
                      <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-gray-800 text-center text-slate-500">
                        No questions configured for this section.
                      </div>
                    ) : (
                      activeTask.config.questions.map((q: any, qIdx: number) => {
                        const ans = questionAnswers[q.id] || {};
                        const selectedIdxs = ans.selectedOptionIndexes || [];
                        const selectedIds = ans.selectedOptionIds || [];
                        const textAns = ans.textResponse || "";
                        const isAnswered = selectedIds.length > 0 || selectedIdxs.length > 0 || textAns.trim().length > 0;

                        return (
                          <div
                            key={q.id || qIdx}
                            id={`question-card-${q.id || qIdx}`}
                            className={`p-4 rounded-xl border transition-all ${
                              isAnswered
                                ? "border-emerald-200 bg-white shadow-xs dark:border-emerald-950/70 dark:bg-[#0f1522]"
                                : "border-slate-200 bg-slate-50/60 dark:border-gray-800 dark:bg-gray-900/30"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold">
                                  {qIdx + 1}
                                </span>
                                <span>{q.title || `Question ${qIdx + 1}`}</span>
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isAnswered && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span>Answered</span>
                                  </span>
                                )}
                                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
                                  {q.marks ?? q.points ?? 10} pts
                                </span>
                              </div>
                            </div>

                            <p className="text-xs text-slate-800 dark:text-gray-200 mb-3 font-medium leading-relaxed">
                              {q.prompt}
                            </p>

                            {/* Multiple Choice / Single Select */}
                            {(q.format === "multiple_choice" || q.format === "mcq_single") && (
                              <div className="space-y-2">
                                {(q.options || []).map((opt: any, optIdx: number) => {
                                  const optText = typeof opt === "string" ? opt : opt.text;
                                  const optId = typeof opt === "object" && opt.id ? opt.id : String(optIdx);
                                  const isSelected = selectedIds.includes(optId) || selectedIdxs.includes(optIdx);

                                  return (
                                    <label
                                      key={optIdx}
                                      onClick={() => handleSelectOption(q.id, optId, false)}
                                      className={`flex items-start gap-3 p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                                        isSelected
                                          ? "bg-indigo-50 border-indigo-400 text-indigo-950 dark:bg-indigo-950/40 dark:border-indigo-600 dark:text-indigo-200 font-medium shadow-xs"
                                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-gray-900/80 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-850"
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name={`q_${q.id}`}
                                        checked={isSelected}
                                        onChange={() => {}}
                                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                                      />
                                      <span className="flex-1 leading-normal">{optText}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}

                            {/* Multiple Select */}
                            {(q.format === "multiple_select" || q.format === "mcq_multi") && (
                              <div className="space-y-2">
                                {(q.options || []).map((opt: any, optIdx: number) => {
                                  const optText = typeof opt === "string" ? opt : opt.text;
                                  const optId = typeof opt === "object" && opt.id ? opt.id : String(optIdx);
                                  const isSelected = selectedIds.includes(optId) || selectedIdxs.includes(optIdx);

                                  return (
                                    <label
                                      key={optIdx}
                                      onClick={() => handleSelectOption(q.id, optId, true)}
                                      className={`flex items-start gap-3 p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                                        isSelected
                                          ? "bg-indigo-50 border-indigo-400 text-indigo-950 dark:bg-indigo-950/40 dark:border-indigo-600 dark:text-indigo-200 font-medium shadow-xs"
                                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-gray-900/80 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-850"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => {}}
                                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                                      />
                                      <span className="flex-1 leading-normal">{optText}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}

                            {/* Short Text */}
                            {q.format === "short_text" && (
                              <div className="space-y-1.5">
                                <textarea
                                  value={textAns}
                                  onChange={(e) => handleUpdateTextResponse(q.id, e.target.value)}
                                  placeholder="Type your structured technical response here..."
                                  rows={4}
                                  maxLength={q.maxCharacters || q.charLimit || 1500}
                                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-[#0c1017] dark:text-white leading-relaxed resize-y"
                                />
                                <div className="flex justify-between text-[11px] text-slate-400">
                                  <span>Minimum 10 characters required for automated rubric credit</span>
                                  <span>{textAns.length} / {q.maxCharacters || q.charLimit || 1500} chars</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : activeTask.type === "repository_task" ? (
                <div className="space-y-4 leading-relaxed">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        Codebase Task • Action: {activeTask.config?.taskAction || activeTask.config?.action || "Implement"}
                      </span>
                      <span className="text-slate-400 text-xs">
                        Target Language: {activeTask.config?.targetLanguage || "typescript"}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {activeTask.title}
                    </h3>
                    <p className="text-slate-600 dark:text-gray-400 mt-1">
                      {activeTask.description || activeTask.config?.taskDescription}
                    </p>
                  </div>

                  {/* Acceptance Criteria Checklist */}
                  {activeTask.config?.acceptanceCriteria && activeTask.config.acceptanceCriteria.length > 0 && (
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-2 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                      <h4 className="font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                        <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>Acceptance Criteria:</span>
                      </h4>
                      <ul className="space-y-1.5 text-slate-700 dark:text-gray-300">
                        {activeTask.config.acceptanceCriteria.map((crit: string, cIdx: number) => (
                          <li key={cIdx} className="flex items-start gap-2">
                            <span className="text-indigo-600 dark:text-indigo-400 mt-0.5">•</span>
                            <span>{crit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Permitted Documentation URLs */}
                  {activeTask.config?.permittedDocumentationUrls && activeTask.config.permittedDocumentationUrls.length > 0 && (
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2 dark:border-gray-800 dark:bg-gray-900/40">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-gray-200">
                        <BookOpen className="w-4 h-4 text-indigo-500" />
                        <span>Permitted Documentation & References:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {activeTask.config.permittedDocumentationUrls.map((url: string, uIdx: number) => (
                          <a
                            key={uIdx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 bg-white dark:bg-gray-800 px-2.5 py-1 rounded border border-slate-200 dark:border-gray-700"
                          >
                            <span>{url}</span>
                            <ArrowRight className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5 dark:border-gray-800 dark:bg-gray-900/40">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-gray-200">
                      <ShieldCheck className="w-4 h-4 text-indigo-500" />
                      <span>Evaluation Standards:</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400">
                      Evaluated on architectural fidelity, edge case resilience, clean separation of concerns, and passing all hidden verification assertions.
                    </p>
                  </div>
                </div>
              ) : (
                /* Standard Coding Challenge View */
                <div className="space-y-4 leading-relaxed">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-1 dark:text-white">
                      {activeTask.title || "Scenario & Problem Overview"}
                    </h3>
                    <p className="text-slate-600 dark:text-gray-400">
                      {activeTask.description || "Implement the required solution fulfilling all constraints and passing all verification assertions."}
                    </p>
                  </div>

                  <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 space-y-2 dark:border-rose-900/50 dark:bg-rose-950/20">
                    <h4 className="font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>Reported Regressions & Edge Cases:</span>
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-gray-300">
                      <li>
                        <strong>Priority Inversion:</strong> When sorted descending (<code className="font-mono">order: "desc"</code>), urgent incidents must strictly appear at the top.
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
              )
            )}

            {leftTab === "ai" && (
              <div className="flex flex-col h-full space-y-3">
                {/* Task AI Policy Banner */}
                {activeTask.aiPolicy?.mode === "prohibited" ? (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 flex items-start gap-2.5 shrink-0 shadow-xs">
                    <Shield className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">AI Assistance Prohibited for this Section</div>
                      <div className="text-[11px] opacity-90 mt-0.5">
                        {activeTask.aiPolicy.candidateDisclosure ||
                          "The company has configured this section to be solved independently without AI generation."}
                      </div>
                    </div>
                  </div>
                ) : activeTask.aiPolicy?.mode === "restricted_explainer" ? (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300 flex items-start gap-2.5 shrink-0 shadow-xs">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">AI Explainer Mode Active</div>
                      <div className="text-[11px] opacity-90 mt-0.5">
                        AI assistance is restricted to explaining architectural concepts and debugging patterns. Direct code generation and patch proposals are disabled for this section.
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {aiHistory.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl text-xs leading-relaxed ${msg.role === "candidate"
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
                    disabled={
                      isAskingAI ||
                      budgetStatus.isExhausted ||
                      activeTask.aiPolicy?.mode === "prohibited" ||
                      isExpired ||
                      sessionStatus === "submitted"
                    }
                    placeholder={
                      sessionStatus === "submitted"
                        ? "Assessment is submitted (AI locked)"
                        : isExpired
                          ? "Assessment time elapsed — AI assistance is locked"
                          : activeTask.aiPolicy?.mode === "prohibited"
                            ? "AI assistance is locked for this section by company policy"
                            : budgetStatus.isExhausted
                              ? "AI Quota Exhausted ($0.25 USD limit reached)"
                              : "Ask AI for explanation, edge cases, or code proposals..."
                    }
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={
                      isAskingAI ||
                      !aiQuestion.trim() ||
                      activeTask.aiPolicy?.mode === "prohibited" ||
                      budgetStatus.isExhausted ||
                      isExpired ||
                      sessionStatus === "submitted"
                    }
                    className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane (Dynamic by Task Type) */}
        {activeTask.type === "question_set" ? (
          <div className="w-1/2 flex flex-col bg-slate-50 dark:bg-[#0c1017] border-l border-slate-200 dark:border-gray-800 overflow-hidden">
            {/* Top Toolbar */}
            <div className="h-10 border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900/80 px-4 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800 dark:text-gray-200 flex items-center gap-1.5">
                <ListFilter className="w-4 h-4 text-indigo-500" />
                <span>Section Overview & Question Navigator</span>
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {activeTask.weight ?? activeTask.points ?? 30} Points Total
              </span>
            </div>

            {/* Section Progress & Navigator */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Progress Summary Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900/50 shadow-xs space-y-3">
                {(() => {
                  const questions = activeTask.config?.questions || [];
                  const answeredCount = questions.filter((q: any) => {
                    const ans = questionAnswers[q.id];
                    return (
                      (ans?.selectedOptionIds && ans.selectedOptionIds.length > 0) ||
                      (ans?.selectedOptionIndexes && ans.selectedOptionIndexes.length > 0) ||
                      (ans?.textResponse && ans.textResponse.trim().length > 0)
                    );
                  }).length;
                  const percent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

                  return (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 dark:text-white">
                          Section Completion Progress
                        </span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {answeredCount} / {questions.length} Answered ({percent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-gray-800 overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Questions Checklist */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                  Questions in this Section:
                </div>
                <div className="space-y-2">
                  {(activeTask.config?.questions || []).map((q: any, qIdx: number) => {
                    const ans = questionAnswers[q.id];
                    const isAnswered =
                      (ans?.selectedOptionIds && ans.selectedOptionIds.length > 0) ||
                      (ans?.selectedOptionIndexes && ans.selectedOptionIndexes.length > 0) ||
                      (ans?.textResponse && ans.textResponse.trim().length > 0);

                    return (
                      <div
                        key={q.id || qIdx}
                        onClick={() => {
                          const elem = document.getElementById(`question-card-${q.id || qIdx}`);
                          elem?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        className={`p-3 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                          isAnswered
                            ? "bg-white border-emerald-200 dark:bg-gray-900/60 dark:border-emerald-900/60 shadow-xs"
                            : "bg-white border-slate-200 dark:bg-gray-900/30 dark:border-gray-800 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isAnswered
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400"
                            }`}
                          >
                            {qIdx + 1}
                          </span>
                          <span className="font-medium text-slate-800 dark:text-gray-200 line-clamp-1 max-w-[280px]">
                            {q.title || q.prompt}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">
                            {q.marks ?? q.points ?? 10} pts
                          </span>
                          {isAnswered ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Company Section Policy Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900/40 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                  <ShieldCheck className="w-4 h-4 text-indigo-500" />
                  <span>Company Assessment Policy</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-gray-400 leading-relaxed">
                  {activeTask.aiPolicy?.mode === "prohibited"
                    ? "AI assistance is locked for this technical questions section to evaluate core engineering fundamentals directly."
                    : "Responses are evaluated against deterministic rubrics and calibration thresholds upon submission."}
                </p>
              </div>

              {/* Section Transition Action */}
              <div className="pt-2">
                {activeTaskIndex < tasks.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => handleSwitchTask(activeTaskIndex + 1)}
                    className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <span>Proceed to Next Section: {tasks[activeTaskIndex + 1]?.title}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsSubmitModalOpen(true)}
                    className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Review & Submit Final Assessment</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : activeTask.type === "repository_task" ? (
          <div className="w-1/2 flex flex-col bg-[#0d121c] overflow-hidden text-gray-100">
            {/* Virtual File Tabs Toolbar */}
            <div className="h-10 border-b border-slate-800 bg-slate-900/90 px-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1 overflow-x-auto py-1">
                {Object.keys(repoFiles).map((filePath) => {
                  const isCur = activeRepoFilePath === filePath;
                  const isRO = repoFiles[filePath]?.isReadOnly;

                  return (
                    <button
                      key={filePath}
                      type="button"
                      onClick={() => setActiveRepoFilePath(filePath)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-[11px] transition-all cursor-pointer ${
                        isCur
                          ? "bg-indigo-600 text-white font-semibold shadow-xs"
                          : "text-gray-400 hover:text-gray-200 hover:bg-slate-800"
                      }`}
                    >
                      <FileCode className="w-3 h-3" />
                      <span>{filePath}</span>
                      {isRO && <Lock className="w-2.5 h-2.5 text-amber-400 ml-0.5" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleRequestSolutionProposal}
                  disabled={
                    isAskingAI ||
                    budgetStatus.isExhausted ||
                    activeTask.aiPolicy?.mode === "prohibited" ||
                    isPaused ||
                    isExpired ||
                    sessionStatus === "submitted"
                  }
                  className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors flex items-center gap-1 text-[11px] shadow-xs disabled:opacity-50"
                  title="Ask AI for a solution proposal to inspect and review"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Propose with AI</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Reset current file back to initial starter contents?")) {
                      const orig =
                        activeTask.config?.starterFiles?.[activeRepoFilePath] ||
                        activeTask.config?.fileTree?.find((f: any) => f.path === activeRepoFilePath)?.content ||
                        "";
                      setRepoFiles((prev) => ({
                        ...prev,
                        [activeRepoFilePath]: { ...prev[activeRepoFilePath], content: orig },
                      }));
                      setAppliedNotice("File reset to starter state.");
                      setTimeout(() => setAppliedNotice(null), 3000);
                    }
                  }}
                  disabled={
                    sessionStatus === "submitted" ||
                    isPaused ||
                    (isExpired && !inGracePeriod) ||
                    repoFiles[activeRepoFilePath]?.isReadOnly
                  }
                  className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-[11px] disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Read-only Banner if applicable */}
            {repoFiles[activeRepoFilePath]?.isReadOnly && (
              <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-1.5 text-[11px] text-amber-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  <strong>Read-Only File:</strong> This repository file is locked for reference. Modify your target implementation files.
                </span>
              </div>
            )}

            {/* Editor Area */}
            <div className="flex-1 overflow-hidden p-2">
              <textarea
                value={repoFiles[activeRepoFilePath]?.content || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setRepoFiles((prev) => ({
                    ...prev,
                    [activeRepoFilePath]: { ...prev[activeRepoFilePath], content: val },
                  }));
                }}
                readOnly={
                  sessionStatus === "submitted" ||
                  isPaused ||
                  (isExpired && !inGracePeriod) ||
                  Boolean(repoFiles[activeRepoFilePath]?.isReadOnly)
                }
                spellCheck={false}
                className={`w-full h-full bg-[#090d16] p-4 font-mono text-xs text-gray-100 resize-none focus:outline-none border border-slate-800 rounded-lg leading-relaxed selection:bg-indigo-600 ${
                  sessionStatus === "submitted" || isPaused || (isExpired && !inGracePeriod) || repoFiles[activeRepoFilePath]?.isReadOnly
                    ? "opacity-75 cursor-not-allowed bg-slate-950/80"
                    : ""
                }`}
              />
            </div>

            {/* Bottom Test Suite Bar */}
            <div className="h-44 border-t border-slate-800 bg-[#0c1017] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 text-xs">
                <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Repository Acceptance Test Suite</span>
                </span>
                {testResult && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      testResult.passed ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                    }`}
                  >
                    {testResult.passed
                      ? "ALL TESTS PASSED"
                      : `${testResult.tests.filter((t) => t.passed).length}/${testResult.tests.length || 1} PASSED`}
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
                {!testResult && (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-1">
                    <span>Click "Run Tests" in top bar to execute acceptance tests in sandbox.</span>
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
        ) : (
          /* Standard Coding Challenge Right Pane */
          <div className="w-1/2 flex flex-col bg-[#0d121c] overflow-hidden text-gray-100">
            {/* Top Editor Toolbar */}
            <div className="h-10 border-b border-slate-800 bg-slate-900/90 px-4 flex items-center justify-between text-xs">
              <span className="font-mono text-indigo-400 font-semibold flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5" />
                <span>
                  {activeTask.config?.language === "java"
                    ? "CandidateSolution.java"
                    : activeTask.config?.language === "python"
                    ? "solution.py"
                    : "src/useTicketQueue.ts"}
                </span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRequestSolutionProposal}
                  disabled={
                    isAskingAI ||
                    budgetStatus.isExhausted ||
                    activeTask.aiPolicy?.mode === "prohibited" ||
                    isPaused ||
                    isExpired ||
                    sessionStatus === "submitted"
                  }
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
                      const orig = activeTask.config?.starterCode || sessionData?.starterCode || STARTER_CODE;
                      setCode(orig);
                      setAppliedNotice("Starter code restored.");
                      setTimeout(() => setAppliedNotice(null), 3000);
                    }
                  }}
                  disabled={sessionStatus === "submitted" || isPaused || (isExpired && !inGracePeriod)}
                  className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-[11px] disabled:opacity-50"
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
                readOnly={sessionStatus === "submitted" || isPaused || (isExpired && !inGracePeriod)}
                spellCheck={false}
                className={`w-full h-full bg-[#090d16] p-4 font-mono text-xs text-gray-100 resize-none focus:outline-none border border-slate-800 rounded-lg leading-relaxed selection:bg-indigo-600 ${
                  sessionStatus === "submitted" || isPaused || (isExpired && !inGracePeriod)
                    ? "opacity-75 cursor-not-allowed bg-slate-950/80"
                    : ""
                }`}
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
                      ? "ALL TESTS PASSED"
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
        )}
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

      {/* Cryptographic Submission Receipt Modal (Task 14 / AD #9) */}
      {isReceiptModalOpen && submissionReceipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-gray-800 dark:bg-[#0d131f]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Assessment Submitted Successfully
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Your solution has been cryptographically signed and archived for evaluation.
                  </p>
                </div>
              </div>
            </div>

            {/* Cryptographic SHA-256 Fingerprint */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-gray-900/70 border border-slate-200 dark:border-gray-800 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-gray-400 font-sans text-[11px] font-semibold">
                <span className="flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Submission Fingerprint (SHA-256):</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(submissionReceipt.submissionFingerprint);
                    setCopiedReceiptFp(true);
                    setTimeout(() => setCopiedReceiptFp(false), 2000);
                  }}
                  className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
                >
                  {copiedReceiptFp ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedReceiptFp ? "Copied" : "Copy Hash"}</span>
                </button>
              </div>
              <div className="text-indigo-600 dark:text-indigo-400 break-all select-all font-bold">
                {submissionReceipt.submissionFingerprint}
              </div>
            </div>

            {/* Verification & Diff Highlights */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/50">
                <span className="text-[11px] text-slate-500 dark:text-gray-400 block mb-0.5">Test Suite Pass:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {submissionReceipt.artifact.testExecutionLog.passedCount} / {submissionReceipt.artifact.testExecutionLog.totalCount} Passed
                </span>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/50">
                <span className="text-[11px] text-slate-500 dark:text-gray-400 block mb-0.5">Code Changes:</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  +{submissionReceipt.artifact.codeDiff.additions} / -{submissionReceipt.artifact.codeDiff.deletions} lines
                </span>
              </div>
            </div>

            {/* Candidate Technical Explanation */}
            <div className="space-y-1.5 text-xs">
              <span className="font-semibold text-slate-700 dark:text-gray-300">
                Your Technical Explanation:
              </span>
              <p className="p-3 rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 italic text-[11px] leading-relaxed max-h-32 overflow-y-auto">
                "{submissionReceipt.artifact.technicalExplanation}"
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-gray-800">
              <span className="text-[11px] text-slate-400 font-mono">
                Receipt ID: {submissionReceipt.submissionId.slice(0, 18)}...
              </span>
              <div className="flex items-center gap-2">
                {scorecard && (
                  <button
                    onClick={() => {
                      setIsReceiptModalOpen(false);
                      setIsScorecardOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 font-semibold text-xs transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                  >
                    <Award className="w-3.5 h-3.5 text-indigo-500" />
                    <span>View Scorecard</span>
                  </button>
                )}
                <button
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs transition-colors"
                >
                  Close Receipt
                </button>
              </div>
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
