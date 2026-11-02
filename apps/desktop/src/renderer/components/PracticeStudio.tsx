import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Terminal,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Coins,
  Send,
  Award,
  BookOpen,
  ArrowRight,
  Code2,
  RefreshCw,
  Camera,
  Layers,
  ChevronRight,
  Lightbulb,
  Check,
  RotateCcw,
  Sliders,
  HelpCircle,
  TrendingUp,
  X,
  FileText,
  Copy,
} from "lucide-react";
import { ApiClient } from "../services/apiClient.js";
import type {
  PracticeChallenge,
  PracticeDifficulty,
  PracticeFeedbackCard,
  PracticeSubmissionRequest,
  PracticeTrack,
  CodeValidationResponse,
  AIResponse,
} from "@ai-copilot/contracts";

interface PracticeStudioProps {
  onOpenCapture?: () => void;
  onExit?: () => void;
}

export const PracticeStudio: React.FC<PracticeStudioProps> = ({
  onOpenCapture,
  onExit,
}) => {
  // Navigation State
  const [activeStage, setActiveStage] = useState<"catalog" | "workspace" | "feedback">("catalog");
  const [challenges, setChallenges] = useState<PracticeChallenge[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<PracticeChallenge | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<PracticeTrack | "all">("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<PracticeDifficulty | "all">("all");
  const [isLoadingChallenges, setIsLoadingChallenges] = useState(false);

  // Active Workspace State
  const [code, setCode] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [simulatedBudgetUsd, setSimulatedBudgetUsd] = useState(0.25);
  const [consumedBudgetUsd, setConsumedBudgetUsd] = useState(0);
  const [aiQueriesCount, setAiQueriesCount] = useState(0);
  const [patchesAccepted, setPatchesAccepted] = useState(0);
  const [patchesRejected, setPatchesRejected] = useState(0);
  const [testRunsCount, setTestRunsCount] = useState(0);

  // Tests & AI
  const [testResult, setTestResult] = useState<CodeValidationResponse | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<"brief" | "tests" | "hints">("brief");
  const [unlockedHints, setUnlockedHints] = useState<number[]>([]);

  // AI Assistant Drawer
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(true);
  const [aiPromptInput, setAiPromptInput] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiMessages, setAiMessages] = useState<
    Array<{ role: "user" | "assistant"; text: string; patch?: string | undefined }>
  >([]);
  const [pendingPatchToReview, setPendingPatchToReview] = useState<string | null>(null);

  // Submission & Feedback
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [technicalExplanation, setTechnicalExplanation] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [feedbackCard, setFeedbackCard] = useState<PracticeFeedbackCard | null>(null);
  const [showSolutionTemplate, setShowSolutionTemplate] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Load catalog on mount
  useEffect(() => {
    loadCatalog();
  }, [selectedTrack, selectedDifficulty]);

  // Timer countdown / elapsed
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && activeStage === "workspace") {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, activeStage]);

  const loadCatalog = async () => {
    try {
      setIsLoadingChallenges(true);
      const trackParam = selectedTrack === "all" ? undefined : selectedTrack;
      const diffParam = selectedDifficulty === "all" ? undefined : selectedDifficulty;
      const data = await ApiClient.listPracticeChallenges(trackParam, diffParam);
      setChallenges(data.challenges);
    } catch (err) {
      console.error("Failed to load practice catalog:", err);
    } finally {
      setIsLoadingChallenges(false);
    }
  };

  const handleStartChallenge = (challenge: PracticeChallenge) => {
    setSelectedChallenge(challenge);
    setCode(challenge.starterCode);
    setElapsedSeconds(0);
    setIsTimerRunning(true);
    setSimulatedBudgetUsd(challenge.simulatedAiBudgetUsd || 0.25);
    setConsumedBudgetUsd(0);
    setAiQueriesCount(0);
    setPatchesAccepted(0);
    setPatchesRejected(0);
    setTestRunsCount(0);
    setTestResult(null);
    setUnlockedHints([]);
    setAiMessages([
      {
        role: "assistant",
        text: `Welcome to the Practice Studio! I am your AI engineering collaborator for "${challenge.title}". You can ask me to explain unfamiliar patterns, trace control flow, or propose minimal bug fixes within your simulated $${challenge.simulatedAiBudgetUsd.toFixed(2)} token budget.`,
      },
    ]);
    setActiveStage("workspace");
    setWorkspaceTab("brief");
  };

  const handleRunTests = async () => {
    if (!selectedChallenge) return;
    try {
      setIsRunningTests(true);
      setTestRunsCount((prev) => prev + 1);
      setWorkspaceTab("tests");
      const result = await ApiClient.validateCode({
        language: "typescript",
        code,
        testCode: selectedChallenge.verificationTestCode,
        timeoutMs: 4000,
        memoryLimitMb: 128,
      });
      setTestResult(result);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to execute tests in sandbox");
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleSendAiPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPromptInput.trim() || !selectedChallenge || isAiGenerating) return;

    const remainingBudget = simulatedBudgetUsd - consumedBudgetUsd;
    if (remainingBudget <= 0.01) {
      alert("Simulated AI Budget Exhausted ($0.25). You can continue coding independently and running sandbox tests.");
      return;
    }

    const userText = aiPromptInput.trim();
    setAiPromptInput("");
    setAiMessages((prev) => [...prev, { role: "user", text: userText }]);
    setIsAiGenerating(true);

    try {
      const resp = await ApiClient.generateAnswer({
        task: "debug",
        question: userText,
        code,
        context: [{ content: selectedChallenge.description, source: "user" }],
        responseStyle: "concise",
      });

      const queryCost = resp.usage?.estimatedCostUsd || 0.025;
      setConsumedBudgetUsd((prev) => Math.min(simulatedBudgetUsd, prev + queryCost));
      setAiQueriesCount((prev) => prev + 1);

      const assistantReply = resp.approach && resp.approach.length > 0
        ? `${resp.approach.join("\n")}\n\n${resp.explanation}`
        : resp.explanation || "Reviewed code and proposed patch.";

      setAiMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: assistantReply,
          ...(resp.code ? { patch: resp.code } : {}),
        },
      ]);

      if (resp.code) {
        setPendingPatchToReview(resp.code);
      }
    } catch (err: unknown) {
      setAiMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: err instanceof Error ? `Error: ${err.message}` : "Failed to consult AI assistant.",
        },
      ]);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleAcceptPatch = (patchCode: string) => {
    setCode(patchCode);
    setPatchesAccepted((prev) => prev + 1);
    setPendingPatchToReview(null);
  };

  const handleRejectPatch = () => {
    setPatchesRejected((prev) => prev + 1);
    setPendingPatchToReview(null);
  };

  const handleSubmitPractice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChallenge) return;
    try {
      setIsEvaluating(true);
      setIsTimerRunning(false);

      // Final test run verification
      let finalTestRun = testResult;
      if (!finalTestRun) {
        finalTestRun = await ApiClient.validateCode({
          language: "typescript",
          code,
          testCode: selectedChallenge.verificationTestCode,
          timeoutMs: 4000,
          memoryLimitMb: 128,
        });
        setTestResult(finalTestRun);
      }

      const passedCount = finalTestRun.tests.filter((t) => t.passed).length;
      const totalCount = finalTestRun.tests.length;

      const payload: PracticeSubmissionRequest = {
        challengeId: selectedChallenge.id,
        candidateCode: code,
        technicalExplanation: technicalExplanation.trim(),
        elapsedSeconds,
        aiQueriesCount,
        aiBudgetConsumedUsd: consumedBudgetUsd,
        patchesAccepted,
        patchesRejected,
        testRunsCount,
        testResults: {
          passed: passedCount,
          total: totalCount,
          durationMs: finalTestRun.durationMs,
          tests: finalTestRun.tests.map((t) => ({
            name: t.name,
            passed: t.passed,
            durationMs: t.durationMs,
            error: t.error,
          })),
        },
      };

      const res = await ApiClient.evaluatePracticeSubmission(payload);
      setFeedbackCard(res.feedback);
      setIsSubmitModalOpen(false);
      setActiveStage("feedback");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // ----------------------------------------------------------------------------
  // Render: Stage 1 Catalog View
  // ----------------------------------------------------------------------------
  if (activeStage === "catalog") {
    return (
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-gray-100 overflow-y-auto">
        {/* Hero Section */}
        <div className="border-b border-slate-200 dark:border-gray-800 bg-white/70 dark:bg-[#0d131f]/80 px-8 py-8">
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                    <Sparkles className="w-6 h-6" />
                  </span>
                  <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Candidate Practice Studio & Diagnostic Engine
                  </h1>
                </div>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 max-w-2xl leading-relaxed">
                  Practice production-grade debugging and refactoring challenges in an isolated sandbox with a managed AI assistant. Receive instant 7-dimension rubric feedback and AI reliance metrics.
                </p>
              </div>

              {onOpenCapture && (
                <button
                  onClick={onOpenCapture}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition-all shrink-0"
                >
                  <Camera className="w-4 h-4" />
                  <span>Snap Question from Screen</span>
                </button>
              )}
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-gray-800 text-xs font-semibold">
                <span className="px-2 text-[10px] uppercase tracking-wider text-slate-400 font-bold">Track:</span>
                {(["all", "frontend", "backend", "systems"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTrack(t)}
                    className={`px-3 py-1 rounded-lg capitalize transition-all ${
                      selectedTrack === t
                        ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400 font-bold"
                        : "text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-gray-800 text-xs font-semibold">
                <span className="px-2 text-[10px] uppercase tracking-wider text-slate-400 font-bold">Tier:</span>
                {(["all", "junior", "mid", "senior", "staff"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedDifficulty(d)}
                    className={`px-3 py-1 rounded-lg capitalize transition-all ${
                      selectedDifficulty === d
                        ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400 font-bold"
                        : "text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Challenges Grid */}
        <div className="flex-1 p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                Curated Engineering Challenges ({challenges.length})
              </h2>
            </div>

            {isLoadingChallenges ? (
              <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Loading practice challenges...</span>
              </div>
            ) : challenges.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-gray-800 text-xs text-slate-400">
                No challenges match the selected filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {challenges.map((chal) => (
                  <div
                    key={chal.id}
                    className="flex flex-col rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] p-6 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        chal.difficulty === "junior"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : chal.difficulty === "mid"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                          : chal.difficulty === "senior"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                      }`}>
                        {chal.difficulty} • {chal.track}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{chal.estimatedMinutes}m</span>
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {chal.title}
                    </h3>

                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-2 line-clamp-3 leading-relaxed">
                      {chal.description.replace(/###.*?\n/g, "").slice(0, 160)}...
                    </p>

                    <div className="flex flex-wrap gap-1 mt-4 pt-4 border-t border-slate-100 dark:border-gray-800/80">
                      {chal.tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-gray-800 font-mono text-slate-600 dark:text-gray-300">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <div className="mt-5 pt-3 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono">
                        AI Cap: ${chal.simulatedAiBudgetUsd.toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleStartChallenge(chal)}
                        className="flex items-center gap-1 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs transition-colors"
                      >
                        <span>Start Challenge</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------------
  // Render: Stage 2 Active Practice Workspace
  // ----------------------------------------------------------------------------
  if (activeStage === "workspace" && selectedChallenge) {
    const budgetRemaining = Math.max(0, simulatedBudgetUsd - consumedBudgetUsd);
    const budgetPercent = (consumedBudgetUsd / simulatedBudgetUsd) * 100;

    return (
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-gray-100 overflow-hidden">
        {/* Top Workspace Header */}
        <div className="border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveStage("catalog")}
              className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white font-semibold flex items-center gap-1"
            >
              <span>← Catalog</span>
            </button>
            <span className="text-slate-300 dark:text-gray-700">|</span>
            <span className="font-bold text-xs text-slate-900 dark:text-white">
              {selectedChallenge.title}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
              {selectedChallenge.difficulty}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Timer */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-gray-800 text-xs font-mono font-bold">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              <span>{formatTimer(elapsedSeconds)}</span>
              <span className="text-slate-400 font-normal">/ {selectedChallenge.estimatedMinutes}m</span>
            </div>

            {/* AI Budget */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-100 dark:bg-gray-800 text-xs font-mono">
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              <span className="font-bold">${budgetRemaining.toFixed(3)}</span>
              <span className="text-slate-400 text-[10px]">left</span>
              <div className="w-12 bg-slate-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full ${budgetPercent > 80 ? "bg-rose-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, budgetPercent)}%` }}
                />
              </div>
            </div>

            {/* Actions */}
            <button
              onClick={handleRunTests}
              disabled={isRunningTests}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs transition-colors"
            >
              <Play className={`w-3.5 h-3.5 ${isRunningTests ? "animate-spin" : ""}`} />
              <span>{isRunningTests ? "Running Tests..." : "Run Tests"}</span>
            </button>

            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs transition-colors"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Submit for Diagnostic Review</span>
            </button>
          </div>
        </div>

        {/* Workspace Body: Split Screen */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Problem Brief, Assertions, Hints */}
          <div className="w-1/3 min-w-[340px] max-w-md border-r border-slate-200 dark:border-gray-800 flex flex-col bg-white dark:bg-[#0c121e]">
            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-gray-800 text-xs font-semibold">
              <button
                onClick={() => setWorkspaceTab("brief")}
                className={`flex-1 py-3 border-b-2 transition-all ${
                  workspaceTab === "brief"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-slate-50/60 dark:bg-gray-900/40"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-gray-400"
                }`}
              >
                Problem Brief
              </button>
              <button
                onClick={() => setWorkspaceTab("tests")}
                className={`flex-1 py-3 border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                  workspaceTab === "tests"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-slate-50/60 dark:bg-gray-900/40"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-gray-400"
                }`}
              >
                <span>Assertions</span>
                {testResult && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    testResult.passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                  }`}>
                    {testResult.tests.filter((t) => t.passed).length}/{testResult.tests.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setWorkspaceTab("hints")}
                className={`flex-1 py-3 border-b-2 transition-all ${
                  workspaceTab === "hints"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-slate-50/60 dark:bg-gray-900/40"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-gray-400"
                }`}
              >
                Hints ({selectedChallenge.hints.length})
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 p-5 overflow-y-auto text-xs leading-relaxed">
              {workspaceTab === "brief" && (
                <div className="space-y-4">
                  <div className="prose dark:prose-invert text-xs space-y-3">
                    <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 dark:text-gray-300">
                      {selectedChallenge.description}
                    </pre>
                  </div>
                </div>
              )}

              {workspaceTab === "tests" && (
                <div className="space-y-3">
                  {!testResult ? (
                    <div className="p-8 text-center text-slate-400 space-y-2">
                      <Terminal className="w-8 h-8 mx-auto text-slate-300 dark:text-gray-700" />
                      <p>No test runs executed yet.</p>
                      <button
                        onClick={handleRunTests}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs"
                      >
                        Run Sandbox Tests
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-gray-800">
                        <span className="font-bold text-slate-900 dark:text-white">
                          Execution: {testResult.durationMs}ms
                        </span>
                        <span className={`font-bold ${testResult.passed ? "text-emerald-600" : "text-rose-600"}`}>
                          {testResult.tests.filter((t) => t.passed).length} / {testResult.tests.length} Passed
                        </span>
                      </div>

                      {testResult.tests.map((t, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/60 dark:bg-gray-900/40 space-y-1"
                        >
                          <div className="flex items-center gap-2">
                            {t.passed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                            )}
                            <span className="font-bold font-mono text-[11px] text-slate-800 dark:text-gray-200">
                              {t.name}
                            </span>
                          </div>
                          {t.error && (
                            <pre className="p-2 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap">
                              {t.error}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {workspaceTab === "hints" && (
                <div className="space-y-3">
                  <p className="text-slate-500 text-[11px]">
                    Hints provide architectural direction without spoiling the complete solution.
                  </p>
                  {selectedChallenge.hints.map((hint, idx) => {
                    const isUnlocked = unlockedHints.includes(idx);
                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900/40 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 dark:text-gray-200 flex items-center gap-1.5">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                            <span>Hint #{idx + 1}</span>
                          </span>
                          {!isUnlocked && (
                            <button
                              onClick={() => setUnlockedHints((prev) => [...prev, idx])}
                              className="text-[10px] text-indigo-600 hover:underline font-semibold"
                            >
                              Reveal Hint
                            </button>
                          )}
                        </div>
                        {isUnlocked ? (
                          <p className="text-slate-700 dark:text-gray-300 leading-relaxed font-sans text-xs">
                            {hint}
                          </p>
                        ) : (
                          <p className="text-slate-400 italic text-[11px]">
                            Hidden to preserve self-directed problem solving.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Center Column: Monaco Code Editor */}
          <div className="flex-1 flex flex-col bg-[#0b0f19] text-slate-200 overflow-hidden">
            <div className="p-2.5 bg-[#0e1322] border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-400" />
                <span className="font-mono text-slate-300 font-semibold">candidateSolution.ts</span>
              </div>
              <button
                onClick={() => setCode(selectedChallenge.starterCode)}
                className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[11px]"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Starter</span>
              </button>
            </div>

            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="flex-1 p-4 bg-[#090d16] font-mono text-xs text-slate-100 resize-none focus:outline-none border-none leading-relaxed select-text"
              spellCheck={false}
            />

            {/* Patch Review Notification if AI proposed a patch */}
            {pendingPatchToReview && (
              <div className="p-3 bg-indigo-950/90 border-t border-indigo-800 flex items-center justify-between text-xs animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 text-indigo-200">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>AI Assistant proposed a code patch. Review before applying:</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAcceptPatch(pendingPatchToReview)}
                    className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs"
                  >
                    Accept Patch
                  </button>
                  <button
                    onClick={handleRejectPatch}
                    className="px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
                  >
                    Reject (Scrutinize)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: AI Assistant Drawer */}
          {isAiDrawerOpen && (
            <div className="w-80 border-l border-slate-200 dark:border-gray-800 flex flex-col bg-white dark:bg-[#0c121e]">
              <div className="p-3 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="font-bold text-slate-900 dark:text-white">AI Assistant</span>
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  {aiQueriesCount} queries asked
                </span>
              </div>

              {/* Message Feed */}
              <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs">
                {aiMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white ml-4"
                        : "bg-slate-100 dark:bg-gray-800 text-slate-800 dark:text-gray-200 mr-2"
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                    {msg.patch && (
                      <div className="mt-2 pt-2 border-t border-slate-200 dark:border-gray-700 font-mono text-[10px]">
                        <span className="font-bold block mb-1">Proposed Code Patch:</span>
                        <pre className="p-2 rounded bg-slate-900 text-slate-100 overflow-x-auto max-h-32">
                          {msg.patch}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
                {isAiGenerating && (
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-gray-800 text-slate-500 flex items-center gap-2 text-xs">
                    <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
                    <span>Analyzing codebase & generating patch...</span>
                  </div>
                )}
              </div>

              {/* Input Form */}
              <form onSubmit={handleSendAiPrompt} className="p-3 border-t border-slate-200 dark:border-gray-800 flex gap-2">
                <input
                  type="text"
                  placeholder="Ask a question about the code..."
                  value={aiPromptInput}
                  onChange={(e) => setAiPromptInput(e.target.value)}
                  disabled={isAiGenerating || budgetRemaining <= 0.01}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={isAiGenerating || !aiPromptInput.trim() || budgetRemaining <= 0.01}
                  className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Submission Confirmation Modal */}
        {isSubmitModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#0d131f] border border-slate-200 dark:border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Submit Solution for Diagnostic Review
                  </h3>
                </div>
                <button
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitPractice} className="p-5 space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 text-indigo-900 dark:text-indigo-200 space-y-1">
                  <p className="font-semibold">Review Criteria:</p>
                  <p className="text-[11px] opacity-90">
                    Your solution will be evaluated across 7 dimensions (Code Comprehension, Problem Framing, AI Collaboration, Critical Evaluation, Debugging, Testing, and Technical Explanation).
                  </p>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                    Technical Explanation & Architectural Trade-offs (Required)
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Summarize root cause of defect, how you fixed it, and algorithmic time/space complexity..."
                    value={technicalExplanation}
                    onChange={(e) => setTechnicalExplanation(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-gray-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSubmitModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-300 font-semibold"
                  >
                    Keep Coding
                  </button>
                  <button
                    type="submit"
                    disabled={isEvaluating || !technicalExplanation.trim()}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-xs flex items-center gap-1.5"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>{isEvaluating ? "Evaluating..." : "Generate Diagnostic Feedback"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------------------------------
  // Render: Stage 3 Instant Diagnostic Feedback Card
  // ----------------------------------------------------------------------------
  if (activeStage === "feedback" && feedbackCard) {
    return (
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-gray-100 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-gray-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Award className="w-5 h-5" />
                </span>
                <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Practice Assessment Diagnostic Report
                </h1>
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                Challenge: <strong>{feedbackCard.challengeTitle}</strong> ({feedbackCard.difficulty} • {feedbackCard.track})
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveStage("catalog")}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs"
              >
                Practice Another Challenge
              </button>
            </div>
          </div>

          {/* Top Score Banner */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] shadow-xs space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Composite Score</span>
              <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
                {feedbackCard.compositeScore} <span className="text-xs text-slate-400 font-normal">/ 100</span>
              </div>
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                feedbackCard.recommendation === "strong_hire"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : feedbackCard.recommendation === "hire"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              }`}>
                {feedbackCard.recommendation.replace("_", " ")}
              </span>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] shadow-xs space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">AI Reliance Profile</span>
              <div className="text-sm font-bold text-slate-900 dark:text-white pt-1">
                {feedbackCard.aiRelianceIndex.label}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-gray-400">
                {feedbackCard.aiRelianceIndex.patchesAccepted} accepted • {feedbackCard.aiRelianceIndex.patchesRejected} rejected
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] shadow-xs space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Sandbox Test Rate</span>
              <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {feedbackCard.speedAndPrecision.testPassRatePercent}%
              </div>
              <div className="text-[11px] text-slate-500 dark:text-gray-400">
                {feedbackCard.speedAndPrecision.testsPassed} of {feedbackCard.speedAndPrecision.testsTotal} passed
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] shadow-xs space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Time Spent</span>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {feedbackCard.speedAndPrecision.elapsedMinutes}m
              </div>
              <div className="text-[11px] text-slate-500 dark:text-gray-400">
                Allocated: {feedbackCard.speedAndPrecision.timeAllocatedMinutes}m
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 text-xs text-indigo-950 dark:text-indigo-200 space-y-1">
            <span className="font-bold uppercase tracking-wider text-[10px] text-indigo-700 dark:text-indigo-300">Executive Assessment Signal:</span>
            <p className="leading-relaxed">{feedbackCard.executiveSummary}</p>
          </div>

          {/* 7-Dimension Rubric Breakdown */}
          <div className="space-y-3">
            <h3 className="font-bold text-xs text-slate-800 dark:text-gray-200 uppercase tracking-wider">
              7-Dimension Rubric Evaluation Breakdown
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {feedbackCard.dimensions.map((dim) => (
                <div
                  key={dim.dimensionId}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] shadow-xs space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {dim.name}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      dim.rating === 4
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : dim.rating === 3
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    }`}>
                      {dim.rating}/4 • {dim.levelLabel} (+{dim.weightedScore} pts)
                    </span>
                  </div>

                  <p className="text-slate-600 dark:text-gray-400 text-[11px] leading-relaxed">
                    {dim.rationale}
                  </p>

                  {dim.keyStrengths.length > 0 && (
                    <div className="pt-1">
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Strengths:</span>
                      <ul className="list-disc list-inside text-[11px] text-slate-600 dark:text-gray-300">
                        {dim.keyStrengths.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {dim.growthAreas.length > 0 && (
                    <div className="pt-1">
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Growth Advice:</span>
                      <ul className="list-disc list-inside text-[11px] text-slate-600 dark:text-gray-300">
                        {dim.growthAreas.map((g, idx) => (
                          <li key={idx}>{g}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actionable Takeaways */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] shadow-xs space-y-3">
            <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span>Actionable Engineering Advice</span>
            </h4>
            <div className="space-y-1.5 text-xs text-slate-700 dark:text-gray-300">
              {feedbackCard.actionableTakeaways.map((tip, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reference Solution Template Toggle */}
          {selectedChallenge?.solutionTemplate && (
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                    Reference Solution Template
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Compare your submission against the canonical idiomatic solution.
                  </p>
                </div>
                <button
                  onClick={() => setShowSolutionTemplate((prev) => !prev)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800 text-xs font-semibold text-slate-700 dark:text-gray-200 transition-colors"
                >
                  {showSolutionTemplate ? "Hide Solution" : "Reveal Canonical Solution"}
                </button>
              </div>

              {showSolutionTemplate && (
                <pre className="p-4 rounded-xl bg-[#090d16] font-mono text-xs text-slate-200 overflow-x-auto border border-slate-800">
                  {selectedChallenge.solutionTemplate}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
