import React, { useState } from "react";
import type {
  AssessmentTemplate,
  AssessmentTask,
  AssessmentTaskType,
  TaskAIPolicy,
  QuestionItem,
  QuestionFormat,
  ProgrammingLanguage,
  RepositoryTaskAction,
  VirtualFile,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  PublishVersionRequest,
  Organization,
} from "@ai-copilot/contracts";
import { scrubTaskForCandidate } from "@ai-copilot/contracts";
import { ApiClient } from "../services/apiClient.js";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Eye,
  FileCode,
  FolderGit2,
  HelpCircle,
  Save,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Layers,
  Sparkles,
  Bot,
  Shield,
  FileText,
  Code,
  Check,
} from "lucide-react";

export interface CompanyAssessmentStudioProps {
  organization: Organization;
  initialTemplate?: AssessmentTemplate | null;
  onClose: () => void;
  onSaved: (template: AssessmentTemplate) => void;
  onPublished?: (template: AssessmentTemplate) => void;
}

export const CompanyAssessmentStudio: React.FC<CompanyAssessmentStudioProps> = ({
  organization,
  initialTemplate,
  onClose,
  onSaved,
  onPublished,
}) => {
  // Navigation / Active View
  const [activeStep, setActiveStep] = useState<"basics" | "tasks" | "preview" | "publish">("tasks");
  const [previewMode, setPreviewMode] = useState<"candidate" | "reviewer">("candidate");

  // Assessment Basics
  const [title, setTitle] = useState(initialTemplate?.title || "Staff Fullstack Systems Assessment");
  const [description, setDescription] = useState(
    initialTemplate?.description ||
      "Comprehensive multi-stage engineering assessment evaluating distributed systems architecture, state management comprehension, and thread-safe implementation."
  );
  const [targetRole, setTargetRole] = useState(
    initialTemplate?.targetRole || "Staff Fullstack Engineer"
  );
  const [difficulty, setDifficulty] = useState<"junior" | "mid" | "senior" | "staff">(
    initialTemplate?.difficulty || "staff"
  );
  const [language, setLanguage] = useState<ProgrammingLanguage>(
    initialTemplate?.language || "typescript"
  );
  const [attemptDurationMinutes, setAttemptDurationMinutes] = useState(
    initialTemplate?.attemptDurationMinutes ?? initialTemplate?.durationMinutes ?? 90
  );
  const [submissionDeadlineDays, setSubmissionDeadlineDays] = useState(
    initialTemplate?.submissionDeadlineDays ?? 7
  );
  const [defaultAiBudgetUsd, setDefaultAiBudgetUsd] = useState(
    initialTemplate?.defaultAiBudgetUsd ?? 0.25
  );

  // Assessment Tasks
  const [tasks, setTasks] = useState<AssessmentTask[]>(() => {
    if (initialTemplate?.tasks && initialTemplate.tasks.length > 0) {
      return JSON.parse(JSON.stringify(initialTemplate.tasks));
    }
    // Default 3-task comprehensive role-specific assessment
    return [
      {
        id: "task_qset_arch",
        type: "question_set",
        title: "Section 1: Distributed Systems & State Architecture",
        description: "Verify conceptual fundamentals on event loops, lock-free concurrency, and immutability.",
        orderIndex: 0,
        estimatedMinutes: 20,
        points: 25,
        isRequired: true,
        aiPolicy: {
          mode: "prohibited",
          disclosureNotice: "AI assistance is strictly prohibited during the architecture question set.",
        },
        config: {
          questions: [
            {
              id: "q1_concurrency",
              format: "mcq_single",
              prompt: "In a high-throughput read-heavy queue, which memory synchronization approach guarantees wait-free execution across worker threads?",
              points: 10,
              isRequired: true,
              options: [
                { id: "opt_cas", text: "Atomic Compare-And-Swap (CAS) with memory barriers", isCorrect: true },
                { id: "opt_mutex", text: "Coarse-grained OS Mutex locking", isCorrect: false },
                { id: "opt_spin", text: "Unbounded Spinlocks with busy waiting", isCorrect: false },
                { id: "opt_sleep", text: "Thread.sleep polling loops", isCorrect: false },
              ],
              explanation: "Lock-free algorithms utilizing hardware CAS instructions provide obstruction-free and wait-free progress guarantees.",
            },
            {
              id: "q2_inversion",
              format: "short_text",
              prompt: "Explain how priority inversion can occur in a multi-producer asynchronous queue, and outline the standard mitigation technique.",
              points: 15,
              isRequired: true,
              charLimit: 600,
              evaluationCriteria: "Candidate should mention lower-priority tasks holding shared resource locks while higher-priority tasks wait, and Priority Inheritance Protocols.",
            },
          ],
        },
      },
      {
        id: "task_repo_debug",
        type: "repository_task",
        title: "Section 2: Codebase Comprehension & Triage Bugfix",
        description: "Investigate and fix a priority queue race condition and array mutation defect in a multi-file service.",
        orderIndex: 1,
        estimatedMinutes: 40,
        points: 40,
        isRequired: true,
        aiPolicy: {
          mode: "full_copilot",
          maxBudgetUsd: 0.25,
          disclosureNotice: "AI Copilot is enabled ($0.25 budget). Proposed code patches require candidate explicit acceptance.",
        },
        config: {
          action: "debug",
          primaryFilePath: "src/queueService.ts",
          fileTree: [
            {
              path: "src/queueService.ts",
              content: `export interface QueueItem { id: string; priority: number; createdAt: number; }\n\nexport function processQueue(items: QueueItem[]): QueueItem[] {\n  // DEFECT: Mutates array in place instead of returning immutable copy\n  return items.sort((a, b) => b.priority - a.priority);\n}`,
              isReadOnly: false,
            },
            {
              path: "src/types.ts",
              content: `export type PriorityLevel = "P0" | "P1" | "P2";\nexport interface Config { maxBatchSize: number; }`,
              isReadOnly: true,
            },
          ],
          acceptanceCriteria: [
            "processQueue does not mutate the input array parameter",
            "Sorts items descending by priority (higher priority first)",
            "Breaks ties deterministically using createdAt ascending",
          ],
          verificationTestCode: `test("processQueue preserves input immutability", () => {\n  const orig = [{ id: "1", priority: 1, createdAt: 100 }];\n  const copy = JSON.stringify(orig);\n  processQueue(orig);\n  if (JSON.stringify(orig) !== copy) throw new Error("Mutated input array");\n});`,
        },
      },
      {
        id: "task_code_rate_limiter",
        type: "coding_challenge",
        title: "Section 3: High-Throughput Token Bucket Rate Limiter",
        description: "Implement a thread-safe token bucket rate limiter with lazy refill and bounded burst tolerance.",
        orderIndex: 2,
        estimatedMinutes: 30,
        points: 35,
        isRequired: true,
        aiPolicy: {
          mode: "restricted_explainer",
          maxBudgetUsd: 0.15,
          disclosureNotice: "AI Explainer Mode: AI can explain architectural trade-offs and complexity, but will not write implementation code.",
        },
        config: {
          language: "typescript",
          starterCode: `export class TokenBucketRateLimiter {\n  private capacity: number;\n  private refillRate: number;\n  private tokens: number;\n  private lastRefill: number;\n\n  constructor(capacity: number, refillRate: number) {\n    this.capacity = capacity;\n    this.refillRate = refillRate;\n    this.tokens = capacity;\n    this.lastRefill = Date.now();\n  }\n\n  public allowRequest(tokensNeeded: number = 1): boolean {\n    // TODO: Implement lazy token refill and atomic decrement\n    return false;\n  }\n}`,
          verificationTestCode: `test("allows burst up to capacity", () => {\n  const tb = new TokenBucketRateLimiter(3, 1);\n  if (!tb.allowRequest(1) || !tb.allowRequest(1) || !tb.allowRequest(1)) throw new Error("Burst failed");\n  if (tb.allowRequest(1)) throw new Error("Exceeded capacity");\n});`,
          hiddenTestCode: `test("refills tokens accurately over elapsed interval", async () => {\n  const tb = new TokenBucketRateLimiter(2, 2);\n  tb.allowRequest(2);\n  await new Promise(r => setTimeout(r, 600));\n  if (!tb.allowRequest(1)) throw new Error("Failed to refill after 600ms");\n});`,
          testCases: [
            { name: "Initial burst allows capacity tokens", isHidden: false },
            { name: "Denies request when bucket exhausted", isHidden: false },
            { name: "Lazy refill computes accurately over elapsed time", isHidden: true },
          ],
        },
      },
    ];
  });

  // Active Task Editor Selection
  const [selectedTaskId, setSelectedTaskId] = useState<string>(tasks[0]?.id || "");
  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  // Status & Feedback
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Publish Form State
  const [versionType, setVersionType] = useState<"major" | "minor" | "patch">("minor");
  const [changelogNotes, setChangelogNotes] = useState(
    initialTemplate
      ? "Configured role-specific multi-task structure with separate question set, codebase triage, and coding challenge."
      : "Initial studio release with multi-stage assessment tasks."
  );

  // Calculated Totals
  const totalPoints = tasks.reduce((sum, t) => sum + (t.points || 0), 0);
  const totalEstimatedMinutes = tasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0);

  // Task Management Handlers
  const handleAddTask = (type: AssessmentTaskType) => {
    const newId = `task_${type}_${Date.now().toString(36)}`;
    let newTask: AssessmentTask;

    if (type === "question_set") {
      newTask = {
        id: newId,
        type: "question_set",
        title: `Technical Questions (${tasks.length + 1})`,
        description: "Evaluate candidate understanding of domain fundamentals and architectural trade-offs.",
        order: tasks.length,
        orderIndex: tasks.length,
        durationMinutes: 15,
        estimatedMinutes: 15,
        weight: 20,
        points: 20,
        isRequired: true,
        aiPolicy: {
          enabled: false,
          mode: "prohibited",
          allowedModel: "gpt-4o-mini",
          maxBudgetUsd: 0.15,
          candidateDisclosure: "AI assistance prohibited for question set.",
          disclosureNotice: "AI assistance prohibited for question set.",
        },
        config: {
          questions: [
            {
              id: `q_${Date.now()}`,
              format: "mcq_single",
              prompt: "Select the primary advantage of immutable data structures in concurrent applications:",
              points: 10,
              marks: 10,
              required: true,
              isRequired: true,
              difficulty: "mid",
              options: [
                { id: "opt_1", text: "Eliminates race conditions without lock contention", isCorrect: true },
                { id: "opt_2", text: "Minimizes memory usage by 90%", isCorrect: false },
                { id: "opt_3", text: "Eliminates need for garbage collection", isCorrect: false },
              ],
              correctOptionIndexes: [0],
            },
          ],
        },
      };
    } else if (type === "coding_challenge") {
      newTask = {
        id: newId,
        type: "coding_challenge",
        title: `Coding Challenge (${tasks.length + 1})`,
        description: "Implement a core algorithmic or systems feature with high efficiency.",
        order: tasks.length,
        orderIndex: tasks.length,
        durationMinutes: 30,
        estimatedMinutes: 30,
        weight: 40,
        points: 40,
        isRequired: true,
        aiPolicy: {
          enabled: true,
          mode: "full_copilot",
          allowedModel: "gpt-4o-mini",
          maxBudgetUsd: 0.25,
          candidateDisclosure: "Full AI Copilot enabled.",
          disclosureNotice: "Full AI Copilot enabled.",
        },
        config: {
          language,
          starterCode: `// Implement your solution below\nexport function solution() {\n  return true;\n}`,
          verificationTestCode: `test("basic functionality", () => {\n  if (!solution()) throw new Error("Test failed");\n});`,
          testCases: [{ name: "Standard case", isHidden: false }],
        },
      };
    } else {
      newTask = {
        id: newId,
        type: "repository_task",
        title: `Codebase Task (${tasks.length + 1})`,
        description: "Explore the virtual multi-file codebase and implement the required changes.",
        order: tasks.length,
        orderIndex: tasks.length,
        durationMinutes: 40,
        estimatedMinutes: 40,
        weight: 40,
        points: 40,
        isRequired: true,
        aiPolicy: {
          enabled: true,
          mode: "full_copilot",
          allowedModel: "gpt-4o-mini",
          maxBudgetUsd: 0.25,
          candidateDisclosure: "AI Copilot enabled.",
          disclosureNotice: "AI Copilot enabled.",
        },
        config: {
          action: "implement",
          taskAction: "implement",
          primaryFileToEdit: "src/main.ts",
          primaryFilePath: "src/main.ts",
          fileTree: [
            { path: "src/main.ts", content: `export function run() {\n  // Implementation here\n}`, isReadOnly: false },
            { path: "src/types.ts", content: `export interface Context { ready: boolean; }`, isReadOnly: true },
          ],
          acceptanceCriteria: ["Feature is implemented according to specification", "Passes all integration assertions"],
          verificationTestCode: `test("runs cleanly", () => {\n  run();\n});`,
        },
      };
    }

    setTasks([...tasks, newTask]);
    setSelectedTaskId(newId);
  };

  const handleDuplicateTask = (task: AssessmentTask) => {
    const dupId = `task_${task.type}_${Date.now().toString(36)}`;
    const duplicated: AssessmentTask = {
      ...JSON.parse(JSON.stringify(task)),
      id: dupId,
      title: `${task.title} (Copy)`,
      orderIndex: tasks.length,
    };
    setTasks([...tasks, duplicated]);
    setSelectedTaskId(dupId);
  };

  const handleDeleteTask = (taskId: string) => {
    if (tasks.length <= 1) {
      alert("An assessment must have at least one task.");
      return;
    }
    const filtered = tasks.filter((t) => t.id !== taskId).map((t, idx) => ({ ...t, orderIndex: idx }));
    setTasks(filtered);
    if (selectedTaskId === taskId) {
      setSelectedTaskId(filtered[0]?.id || "");
    }
  };

  const handleMoveTask = (index: number, direction: "up" | "down") => {
    if ((direction === "up" && index === 0) || (direction === "down" && index === tasks.length - 1)) {
      return;
    }
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const reordered = [...tasks];
    const [moved] = reordered.splice(index, 1);
    if (moved) {
      reordered.splice(targetIdx, 0, moved);
      const updated = reordered.map((t, idx) => ({ ...t, orderIndex: idx }));
      setTasks(updated);
    }
  };

  const handleUpdateTaskField = <K extends keyof AssessmentTask>(field: K, value: AssessmentTask[K]) => {
    if (!selectedTaskId) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === selectedTaskId ? { ...t, [field]: value } : t))
    );
  };

  // Question Set Editing Handlers
  const handleAddQuestionToTask = () => {
    if (!selectedTask || selectedTask.type !== "question_set") return;
    const newQ: QuestionItem = {
      id: `q_${Date.now().toString(36)}`,
      format: "mcq_single",
      prompt: "Enter your question prompt here...",
      points: 10,
      marks: 10,
      required: true,
      isRequired: true,
      difficulty: "mid",
      options: [
        { id: "opt_1", text: "Option A", isCorrect: true },
        { id: "opt_2", text: "Option B", isCorrect: false },
      ],
      correctOptionIndexes: [0],
    };
    const updatedQuestions = [...(selectedTask.config.questions || []), newQ];
    handleUpdateTaskField("config", { ...selectedTask.config, questions: updatedQuestions });
  };

  const handleUpdateQuestion = (qIndex: number, updated: QuestionItem) => {
    if (!selectedTask || selectedTask.type !== "question_set") return;
    const list = [...(selectedTask.config.questions || [])];
    list[qIndex] = updated;
    handleUpdateTaskField("config", { ...selectedTask.config, questions: list });
  };

  const handleDeleteQuestion = (qIndex: number) => {
    if (!selectedTask || selectedTask.type !== "question_set") return;
    const list = [...(selectedTask.config.questions || [])];
    list.splice(qIndex, 1);
    handleUpdateTaskField("config", { ...selectedTask.config, questions: list });
  };

  // Save Draft Template
  const handleSaveDraft = async () => {
    try {
      setIsSaving(true);
      setStatusMessage(null);

      const templateLanguage = (["typescript", "javascript", "python"].includes(language)
        ? language
        : "typescript") as "typescript" | "javascript" | "python";

      const normalizedTasks = tasks.map((t, idx) => ({
        ...t,
        order: t.order ?? t.orderIndex ?? idx,
        weight: t.weight ?? t.points ?? 25,
        durationMinutes: t.durationMinutes ?? t.estimatedMinutes ?? 30,
      }));

      const templateData: CreateTemplateRequest = {
        organizationId: organization.id,
        title: title.trim(),
        description: description.trim(),
        targetRole: targetRole.trim(),
        difficulty,
        language: templateLanguage,
        durationMinutes: attemptDurationMinutes,
        attemptDurationMinutes,
        submissionDeadlineDays,
        defaultAiBudgetUsd,
        tasks: normalizedTasks,
        starterCode: tasks.find((t) => t.type === "coding_challenge")?.config?.starterCode || "",
        verificationTestCode: tasks.find((t) => t.type === "coding_challenge")?.config?.verificationTestCode || "",
      };

      let savedTmpl: AssessmentTemplate;
      if (initialTemplate) {
        const updateReq: UpdateTemplateRequest = {
          title: templateData.title,
          description: templateData.description,
          targetRole: templateData.targetRole,
          difficulty: templateData.difficulty,
          language: templateData.language,
          durationMinutes: templateData.durationMinutes,
          attemptDurationMinutes: templateData.attemptDurationMinutes,
          submissionDeadlineDays: templateData.submissionDeadlineDays,
          defaultAiBudgetUsd: templateData.defaultAiBudgetUsd,
          tasks: templateData.tasks,
          starterCode: templateData.starterCode,
          verificationTestCode: templateData.verificationTestCode,
        };
        savedTmpl = await ApiClient.updateTemplate(organization.id, initialTemplate.id, updateReq);
      } else {
        savedTmpl = await ApiClient.createTemplate(templateData);
      }

      setStatusMessage({ type: "success", text: "Assessment template saved as draft successfully!" });
      onSaved(savedTmpl);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save assessment template.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Publish Immutable Version
  const handlePublishImmutable = async () => {
    try {
      setIsPublishing(true);
      setStatusMessage(null);

      const templateLanguage = (["typescript", "javascript", "python"].includes(language)
        ? language
        : "typescript") as "typescript" | "javascript" | "python";

      const normalizedTasks = tasks.map((t, idx) => ({
        ...t,
        order: t.order ?? t.orderIndex ?? idx,
        weight: t.weight ?? t.points ?? 25,
        durationMinutes: t.durationMinutes ?? t.estimatedMinutes ?? 30,
      }));

      // First ensure latest draft changes are saved
      let activeTemplateId = initialTemplate?.id;
      if (!activeTemplateId) {
        const newTmpl = await ApiClient.createTemplate({
          organizationId: organization.id,
          title: title.trim(),
          description: description.trim(),
          targetRole: targetRole.trim(),
          difficulty,
          language: templateLanguage,
          durationMinutes: attemptDurationMinutes,
          attemptDurationMinutes,
          submissionDeadlineDays,
          defaultAiBudgetUsd,
          tasks: normalizedTasks,
        });
        activeTemplateId = newTmpl.id;
      } else {
        await ApiClient.updateTemplate(organization.id, activeTemplateId, {
          title: title.trim(),
          description: description.trim(),
          targetRole: targetRole.trim(),
          difficulty,
          language: templateLanguage,
          durationMinutes: attemptDurationMinutes,
          attemptDurationMinutes,
          submissionDeadlineDays,
          defaultAiBudgetUsd,
          tasks: normalizedTasks,
        });
      }

      // Publish version
      const pubReq: PublishVersionRequest = {
        organizationId: organization.id,
        templateId: activeTemplateId,
        versionType,
        changelogNotes: changelogNotes.trim(),
      };

      const published = await ApiClient.publishVersion(pubReq);
      const updatedTmpl = await ApiClient.getTemplate(organization.id, activeTemplateId);

      setStatusMessage({
        type: "success",
        text: `Published immutable version ${published.versionNumber} with SHA-256 fingerprint ${published.contentHash.substring(0, 16)}...`,
      });
      onPublished?.(updatedTmpl);
      setTimeout(() => {
        onClose();
      }, 2500);
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to publish immutable assessment version.",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Candidate scrubbed tasks preview
  const candidateScrubbedTasks = tasks.map(scrubTaskForCandidate);

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-gray-100 overflow-hidden font-sans">
      {/* Studio Top Navigation Bar */}
      <div className="h-14 border-b border-slate-200 dark:border-gray-800 bg-white/95 dark:bg-[#0c121e] px-6 flex items-center justify-between shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-gray-800 hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-600 dark:text-gray-400 transition-colors cursor-pointer"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">
                Company Assessment Studio
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40">
                {organization.name}
              </span>
              {initialTemplate && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300">
                  Editing: {initialTemplate.title}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Step Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 text-xs font-semibold">
          <button
            onClick={() => setActiveStep("basics")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeStep === "basics"
                ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400"
                : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            1. Role & Timing
          </button>
          <button
            onClick={() => setActiveStep("tasks")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeStep === "tasks"
                ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400"
                : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>2. Task Assembly</span>
            <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] flex items-center justify-center font-bold">
              {tasks.length}
            </span>
          </button>
          <button
            onClick={() => setActiveStep("preview")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeStep === "preview"
                ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400"
                : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>3. Candidate Preview</span>
          </button>
          <button
            onClick={() => setActiveStep("publish")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeStep === "publish"
                ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400"
                : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>4. Publish Version</span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-700 dark:text-gray-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? "Saving..." : "Save Draft"}</span>
          </button>
          <button
            onClick={() => setActiveStep("publish")}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Publish Assessment</span>
          </button>
        </div>
      </div>

      {/* Status Alert Notification */}
      {statusMessage && (
        <div
          className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between transition-all ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-b border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
              : "bg-rose-50 text-rose-800 border-b border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Main Studio Workspace */}
      <div className="flex-1 overflow-hidden flex">
        {/* ========================================================================= */}
        {/* STEP 1: BASICS & TIMING SEPARATION */}
        {/* ========================================================================= */}
        {activeStep === "basics" && (
          <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto space-y-6">
            <div className="border-b border-slate-200 dark:border-gray-800 pb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Assessment Role & Timing Setup
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                Configure role seniority, assessment title, attempt duration countdown, and candidate deadline window.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              <div className="space-y-1.5 md:col-span-2">
                <label className="font-bold text-slate-700 dark:text-gray-300">
                  Assessment Title (Company Visible & Candidate Facing)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Staff Backend Engineer: High-Throughput Ingress & Concurrency"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-gray-300">
                  Target Engineering Role
                </label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. Senior Backend Engineer"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-gray-300">
                  Seniority Level
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="junior">Junior (0-2 years)</option>
                  <option value="mid">Mid-Level (2-5 years)</option>
                  <option value="senior">Senior (5-8 years)</option>
                  <option value="staff">Staff / Principal (8+ years)</option>
                </select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="font-bold text-slate-700 dark:text-gray-300">
                  Assessment Description & Candidate Welcome Brief
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summarize context, expected areas of evaluation, and engineering focus..."
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Strict Schedule & Timing Separation Invariant */}
              <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 md:col-span-2 space-y-4">
                <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200">
                  <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="font-bold text-sm">
                    Invariant: Schedule Availability vs. Attempt Duration Separation
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 bg-white dark:bg-gray-900 p-3.5 rounded-lg border border-indigo-100 dark:border-gray-800">
                    <label className="font-bold text-slate-800 dark:text-gray-200 flex items-center justify-between">
                      <span>Candidate Attempt Duration (Countdown)</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                        {attemptDurationMinutes} min
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400">
                      Authoritative in-session timer that begins countdown once candidate accepts invitation.
                    </p>
                    <input
                      type="number"
                      min={15}
                      max={240}
                      step={5}
                      value={attemptDurationMinutes}
                      onChange={(e) => setAttemptDurationMinutes(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded border border-slate-300 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-slate-900 dark:text-white font-mono"
                    />
                  </div>

                  <div className="space-y-1.5 bg-white dark:bg-gray-900 p-3.5 rounded-lg border border-indigo-100 dark:border-gray-800">
                    <label className="font-bold text-slate-800 dark:text-gray-200 flex items-center justify-between">
                      <span>Invitation Window / Submission Deadline</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                        {submissionDeadlineDays} days
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400">
                      Overall deadline for candidate to open and complete their assessment link before expiry.
                    </p>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={submissionDeadlineDays}
                      onChange={(e) => setSubmissionDeadlineDays(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded border border-slate-300 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Default AI Policy */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 md:col-span-2 space-y-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-500" />
                  <span className="font-bold text-slate-900 dark:text-white">
                    Assessment AI Copilot Budget Ceiling
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-slate-500 dark:text-gray-400">
                    Maximum token spend allowance per candidate across AI-enabled tasks ($0.05 to $1.00 USD). Note: Token usage is never used as a candidate performance score.
                  </p>
                  <div className="flex items-center gap-2 font-mono font-bold text-slate-900 dark:text-white">
                    <span>${defaultAiBudgetUsd.toFixed(2)} USD</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={1.0}
                  step={0.05}
                  value={defaultAiBudgetUsd}
                  onChange={(e) => setDefaultAiBudgetUsd(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={() => setActiveStep("tasks")}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <span>Proceed to Task Assembly</span>
                <ChevronDown className="w-4 h-4 -rotate-90" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: TASK ASSEMBLY & REORDERING STUDIO */}
        {/* ========================================================================= */}
        {activeStep === "tasks" && (
          <div className="flex-1 flex overflow-hidden">
            {/* Task Assembly Left Sidebar (Reorder, Duplicate, Delete) */}
            <div className="w-80 border-r border-slate-200 dark:border-gray-800 flex flex-col bg-white dark:bg-[#0c121e] shrink-0">
              <div className="p-3.5 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs text-slate-900 dark:text-white">
                    Tasks ({tasks.length})
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400">
                    {totalPoints} Total Marks • ~{totalEstimatedMinutes} mins
                  </p>
                </div>

                {/* Add Task Dropdown */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleAddTask("question_set")}
                    title="Add Question Set Task"
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-gray-800 hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-700 dark:text-gray-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Q-Set</span>
                  </button>
                  <button
                    onClick={() => handleAddTask("coding_challenge")}
                    title="Add Coding Challenge Task"
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-gray-800 hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-700 dark:text-gray-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Code</span>
                  </button>
                  <button
                    onClick={() => handleAddTask("repository_task")}
                    title="Add Repository / Codebase Task"
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-gray-800 hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-700 dark:text-gray-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Repo</span>
                  </button>
                </div>
              </div>

              {/* Task Items List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {tasks.map((task, idx) => {
                  const isSelected = task.id === selectedTaskId;
                  return (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-50/50 dark:border-indigo-500 dark:bg-indigo-950/30 shadow-xs"
                          : "border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900/30 hover:border-slate-300 dark:hover:border-gray-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-gray-800 text-slate-700 dark:text-gray-300 text-[10px] flex items-center justify-center font-bold font-mono">
                            {idx + 1}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                              task.type === "question_set"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                : task.type === "coding_challenge"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                            }`}
                          >
                            {task.type === "question_set"
                              ? "Question Set"
                              : task.type === "coding_challenge"
                              ? "Coding Challenge"
                              : "Codebase Task"}
                          </span>
                        </div>

                        {/* Task Reorder & Actions */}
                        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleMoveTask(idx, "up")}
                            disabled={idx === 0}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30"
                            title="Move Up"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveTask(idx, "down")}
                            disabled={idx === tasks.length - 1}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30"
                            title="Move Down"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDuplicateTask(task)}
                            className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                            title="Duplicate Task"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                            title="Delete Task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                        {task.title}
                      </h4>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-gray-400 font-mono">
                        <span>{task.points} Marks</span>
                        <span>{task.estimatedMinutes}m</span>
                        <span
                          className={`font-semibold ${
                            task.aiPolicy?.mode === "prohibited"
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {task.aiPolicy?.mode === "prohibited" ? "AI Off" : "AI Copilot"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Task Editor Right Canvas */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-[#090d16]">
              {selectedTask ? (
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Task Header & Metadata */}
                  <div className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] space-y-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-mono">
                          Task {(selectedTask.orderIndex ?? selectedTask.order ?? 0) + 1} Configuration
                        </span>
                        <span className="text-xs text-slate-400 font-mono">ID: {selectedTask.id}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-xs">
                          <label className="font-semibold text-slate-600 dark:text-gray-400">Points:</label>
                          <input
                            type="number"
                            min={5}
                            max={100}
                            value={selectedTask.points}
                            onChange={(e) => handleUpdateTaskField("points", Number(e.target.value))}
                            className="w-16 px-2 py-1 rounded border border-slate-300 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-xs font-mono font-bold"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <label className="font-semibold text-slate-600 dark:text-gray-400">Duration:</label>
                          <input
                            type="number"
                            min={5}
                            max={120}
                            value={selectedTask.estimatedMinutes}
                            onChange={(e) => handleUpdateTaskField("estimatedMinutes", Number(e.target.value))}
                            className="w-16 px-2 py-1 rounded border border-slate-300 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-xs font-mono font-bold"
                          />
                          <span className="text-[10px] text-slate-400">min</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1 md:col-span-2">
                        <label className="font-bold text-slate-700 dark:text-gray-300">Task Title</label>
                        <input
                          type="text"
                          value={selectedTask.title}
                          onChange={(e) => handleUpdateTaskField("title", e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 font-semibold"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="font-bold text-slate-700 dark:text-gray-300">Description / Goal</label>
                        <textarea
                          rows={2}
                          value={selectedTask.description}
                          onChange={(e) => handleUpdateTaskField("description", e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                        />
                      </div>
                    </div>

                    {/* Per-Task AI Policy Configuration */}
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/70 dark:bg-gray-900/40 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 dark:text-gray-200 flex items-center gap-1.5">
                          <Bot className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Task-Level AI Policy</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          {(["prohibited", "full_copilot", "restricted_explainer"] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() =>
                                handleUpdateTaskField("aiPolicy", {
                                  ...selectedTask.aiPolicy,
                                  mode,
                                })
                              }
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                selectedTask.aiPolicy?.mode === mode
                                  ? mode === "prohibited"
                                    ? "bg-rose-600 text-white"
                                    : "bg-indigo-600 text-white"
                                  : "bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700"
                              }`}
                            >
                              {mode === "prohibited"
                                ? "Prohibited"
                                : mode === "full_copilot"
                                ? "Full Copilot"
                                : "Restricted Explainer"}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="Disclosure notice shown to candidate before starting task..."
                        value={selectedTask.aiPolicy?.disclosureNotice || ""}
                        onChange={(e) =>
                          handleUpdateTaskField("aiPolicy", {
                            ...selectedTask.aiPolicy,
                            mode: selectedTask.aiPolicy?.mode || "full_copilot",
                            disclosureNotice: e.target.value,
                          })
                        }
                        className="w-full px-2.5 py-1 rounded border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-[11px]"
                      />
                    </div>
                  </div>

                  {/* ========================================================= */}
                  {/* FAMILY A: QUESTION SET TASK EDITOR */}
                  {/* ========================================================= */}
                  {selectedTask.type === "question_set" && (
                    <div className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] space-y-4 shadow-xs">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-gray-800 pb-3">
                        <div className="flex items-center gap-2">
                          <HelpCircle className="w-4 h-4 text-amber-500" />
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                            Question Set Configuration ({selectedTask.config.questions?.length || 0} Questions)
                          </h4>
                        </div>
                        <button
                          onClick={handleAddQuestionToTask}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Question</span>
                        </button>
                      </div>

                      <div className="space-y-4">
                        {(selectedTask.config.questions || []).map((q: any, qIdx: number) => (
                          <div
                            key={q.id}
                            className="p-4 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900/30 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                                  Q{qIdx + 1}
                                </span>
                                <select
                                  value={q.format}
                                  onChange={(e) =>
                                    handleUpdateQuestion(qIdx, {
                                      ...q,
                                      format: e.target.value as QuestionFormat,
                                    })
                                  }
                                  className="px-2 py-1 rounded border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-semibold"
                                >
                                  <option value="mcq_single">Single Choice (MCQ)</option>
                                  <option value="mcq_multi">Multiple Choice (Select All)</option>
                                  <option value="short_text">Technical Short Text</option>
                                </select>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1 text-xs">
                                  <span className="text-slate-400">Marks:</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={50}
                                    value={q.points}
                                    onChange={(e) =>
                                      handleUpdateQuestion(qIdx, { ...q, points: Number(e.target.value) })
                                    }
                                    className="w-12 px-1.5 py-0.5 rounded border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-mono"
                                  />
                                </div>
                                <button
                                  onClick={() => handleDeleteQuestion(qIdx)}
                                  className="p-1 text-slate-400 hover:text-rose-500"
                                  title="Delete Question"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <textarea
                              rows={2}
                              value={q.prompt}
                              onChange={(e) => handleUpdateQuestion(qIdx, { ...q, prompt: e.target.value })}
                              placeholder="Question prompt statement..."
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-medium"
                            />

                            {/* Options Editor for MCQ */}
                            {q.format !== "short_text" ? (
                              <div className="space-y-2 pt-1">
                                <span className="text-[11px] font-bold text-slate-500 block">
                                  Answer Options (Mark checkmark for correct):
                                </span>
                                {(q.options || []).map((opt: any, optIdx: number) => (
                                  <div key={opt.id} className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        let updatedOpts;
                                        if (q.format === "mcq_single") {
                                          updatedOpts = q.options?.map((o: any, idx: number) => ({
                                            ...o,
                                            isCorrect: idx === optIdx,
                                          }));
                                        } else {
                                          updatedOpts = q.options?.map((o: any, idx: number) =>
                                            idx === optIdx ? { ...o, isCorrect: !o.isCorrect } : o
                                          );
                                        }
                                        handleUpdateQuestion(qIdx, { ...q, options: updatedOpts });
                                      }}
                                      className={`p-1.5 rounded-md border text-xs flex items-center justify-center cursor-pointer ${
                                        opt.isCorrect
                                          ? "bg-emerald-600 border-emerald-600 text-white"
                                          : "border-slate-300 dark:border-gray-700 text-transparent"
                                      }`}
                                      title={opt.isCorrect ? "Correct answer" : "Mark as correct"}
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                    <input
                                      type="text"
                                      value={opt.text}
                                      onChange={(e) => {
                                        const updatedOpts = q.options?.map((o: any, idx: number) =>
                                          idx === optIdx ? { ...o, text: e.target.value } : o
                                        );
                                        handleUpdateQuestion(qIdx, { ...q, options: updatedOpts });
                                      }}
                                      className="flex-1 px-2.5 py-1 rounded border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updatedOpts = q.options?.filter((_: any, idx: number) => idx !== optIdx);
                                        handleUpdateQuestion(qIdx, { ...q, options: updatedOpts });
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-500"
                                      title="Remove option"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextId = `opt_${Date.now().toString(36)}`;
                                    const updatedOpts = [
                                      ...(q.options || []),
                                      { id: nextId, text: `Option ${(q.options?.length || 0) + 1}`, isCorrect: false },
                                    ];
                                    handleUpdateQuestion(qIdx, { ...q, options: updatedOpts });
                                  }}
                                  className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                                >
                                  + Add Option
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-500">
                                  Grading Rubric / Evaluation Criteria (Hidden from candidate):
                                </label>
                                <input
                                  type="text"
                                  value={q.evaluationCriteria || ""}
                                  onChange={(e) =>
                                    handleUpdateQuestion(qIdx, { ...q, evaluationCriteria: e.target.value })
                                  }
                                  placeholder="Expected concepts, terminology, or algorithmic trade-offs..."
                                  className="w-full px-2.5 py-1 rounded border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* FAMILY B: CODING CHALLENGE TASK EDITOR */}
                  {/* ========================================================= */}
                  {selectedTask.type === "coding_challenge" && (
                    <div className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] space-y-4 shadow-xs">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-gray-800 pb-3">
                        <div className="flex items-center gap-2">
                          <Code className="w-4 h-4 text-emerald-500" />
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                            Coding Challenge Configuration
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-slate-500">Language:</span>
                          <select
                            value={selectedTask.config.language || language}
                            onChange={(e) =>
                              handleUpdateTaskField("config", {
                                ...selectedTask.config,
                                language: e.target.value as ProgrammingLanguage,
                              })
                            }
                            className="px-2 py-1 rounded border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 font-mono text-xs"
                          >
                            <option value="typescript">TypeScript</option>
                            <option value="javascript">JavaScript</option>
                            <option value="python">Python 3</option>
                            <option value="go">Go</option>
                            <option value="java">Java</option>
                            <option value="cpp">C++20</option>
                            <option value="rust">Rust</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-4 text-xs">
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 dark:text-gray-300">
                            Starter Code (Presented to Candidate in Monaco Editor)
                          </label>
                          <textarea
                            rows={8}
                            value={selectedTask.config.starterCode}
                            onChange={(e) =>
                              handleUpdateTaskField("config", {
                                ...selectedTask.config,
                                starterCode: e.target.value,
                              })
                            }
                            className="w-full p-3 rounded-lg border border-slate-300 dark:border-gray-700 bg-slate-900 text-emerald-400 font-mono text-xs leading-relaxed"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 dark:text-gray-300 flex items-center justify-between">
                            <span>Public Verification Tests (Visible to Candidate)</span>
                            <span className="text-[10px] text-slate-400">Node / PyTest / JUnit assertions</span>
                          </label>
                          <textarea
                            rows={6}
                            value={selectedTask.config.verificationTestCode}
                            onChange={(e) =>
                              handleUpdateTaskField("config", {
                                ...selectedTask.config,
                                verificationTestCode: e.target.value,
                              })
                            }
                            className="w-full p-3 rounded-lg border border-slate-300 dark:border-gray-700 bg-slate-900 text-indigo-300 font-mono text-xs leading-relaxed"
                          />
                        </div>

                        {/* Hidden Test Case Protection Invariant */}
                        <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 space-y-2">
                          <div className="flex items-center gap-1.5 text-rose-800 dark:text-rose-300 font-bold">
                            <Shield className="w-3.5 h-3.5" />
                            <span>Hidden Verification Tests (Strict Server-Side Grading Only)</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-gray-400">
                            These tests are executed inside the isolated sandbox only upon final submission. They are completely scrubbed from candidate client payloads.
                          </p>
                          <textarea
                            rows={4}
                            value={selectedTask.config.hiddenTestCode || ""}
                            onChange={(e) =>
                              handleUpdateTaskField("config", {
                                ...selectedTask.config,
                                hiddenTestCode: e.target.value,
                              })
                            }
                            placeholder="Write edge-case assertions or boundary checks that will verify full correctness..."
                            className="w-full p-3 rounded-lg border border-rose-300 dark:border-rose-900/60 bg-slate-900 text-rose-300 font-mono text-xs leading-relaxed"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* FAMILY C: REPOSITORY / CODEBASE TASK EDITOR */}
                  {/* ========================================================= */}
                  {selectedTask.type === "repository_task" && (
                    <div className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0d131f] space-y-4 shadow-xs">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-gray-800 pb-3">
                        <div className="flex items-center gap-2">
                          <FolderGit2 className="w-4 h-4 text-purple-500" />
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                            Repository & Codebase Task Configuration
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-slate-500">Action:</span>
                          <select
                            value={selectedTask.config.action}
                            onChange={(e) =>
                              handleUpdateTaskField("config", {
                                ...selectedTask.config,
                                action: e.target.value as RepositoryTaskAction,
                              })
                            }
                            className="px-2 py-1 rounded border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 font-semibold text-xs capitalize"
                          >
                            <option value="debug">Bug Fixing & Triage</option>
                            <option value="implement">Feature Implementation</option>
                            <option value="refactor">Architecture Refactoring</option>
                            <option value="code_review">Code Review Task</option>
                            <option value="write_tests">Unit & Integration Tests</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-4 text-xs">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="font-bold text-slate-700 dark:text-gray-300">
                              Virtual File Tree ({selectedTask.config.fileTree?.length || 0} Files)
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const newPath = `src/file_${Date.now().toString(36)}.ts`;
                                const newFiles = [
                                  ...(selectedTask.config.fileTree || []),
                                  { path: newPath, content: "// New file content\n", isReadOnly: false },
                                ];
                                handleUpdateTaskField("config", { ...selectedTask.config, fileTree: newFiles });
                              }}
                              className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                            >
                              + Add File to Tree
                            </button>
                          </div>

                          <div className="space-y-2">
                            {(selectedTask.config.fileTree || []).map((file: any, fIdx: number) => (
                              <div
                                key={fIdx}
                                className="p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900/30 space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <input
                                    type="text"
                                    value={file.path}
                                    onChange={(e) => {
                                      const updatedFiles = [...(selectedTask.config.fileTree || [])];
                                      updatedFiles[fIdx] = { ...file, path: e.target.value };
                                      handleUpdateTaskField("config", {
                                        ...selectedTask.config,
                                        fileTree: updatedFiles,
                                      });
                                    }}
                                    className="px-2 py-1 rounded border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 font-mono text-xs font-bold w-1/2"
                                  />
                                  <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={file.isReadOnly}
                                        onChange={(e) => {
                                          const updatedFiles = [...(selectedTask.config.fileTree || [])];
                                          updatedFiles[fIdx] = { ...file, isReadOnly: e.target.checked };
                                          handleUpdateTaskField("config", {
                                            ...selectedTask.config,
                                            fileTree: updatedFiles,
                                          });
                                        }}
                                        className="rounded text-indigo-600"
                                      />
                                      <span className="text-[11px] text-slate-500">Read-Only</span>
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updatedFiles = (selectedTask.config.fileTree || []).filter(
                                          (_: any, idx: number) => idx !== fIdx
                                        );
                                        handleUpdateTaskField("config", {
                                          ...selectedTask.config,
                                          fileTree: updatedFiles,
                                        });
                                      }}
                                      className="text-slate-400 hover:text-rose-500"
                                      title="Remove file"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                                <textarea
                                  rows={5}
                                  value={file.content}
                                  onChange={(e) => {
                                    const updatedFiles = [...(selectedTask.config.fileTree || [])];
                                    updatedFiles[fIdx] = { ...file, content: e.target.value };
                                    handleUpdateTaskField("config", {
                                      ...selectedTask.config,
                                      fileTree: updatedFiles,
                                    });
                                  }}
                                  className="w-full p-2.5 rounded border border-slate-300 dark:border-gray-700 bg-slate-900 text-slate-200 font-mono text-xs"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Acceptance Criteria */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 dark:text-gray-300">
                            Acceptance Criteria (One per line)
                          </label>
                          <textarea
                            rows={3}
                            value={(selectedTask.config.acceptanceCriteria || []).join("\n")}
                            onChange={(e) =>
                              handleUpdateTaskField("config", {
                                ...selectedTask.config,
                                acceptanceCriteria: e.target.value
                                  .split("\n")
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              })
                            }
                            placeholder="e.g. Memory complexity stays O(1) during batch operations..."
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  Select or add a task from the sidebar to configure it.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: CANDIDATE PREVIEW MODE (WITH SCRUBBED HIDDEN TESTS) */}
        {/* ========================================================================= */}
        {activeStep === "preview" && (
          <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-gray-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-indigo-500" />
                  <span>Assessment Preview</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                  Preview exactly what the candidate sees upon accepting their invitation.
                </p>
              </div>

              <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-xs font-semibold">
                <button
                  onClick={() => setPreviewMode("candidate")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    previewMode === "candidate"
                      ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400"
                      : "text-slate-600 dark:text-gray-400"
                  }`}
                >
                  Candidate View (Scrubbed)
                </button>
                <button
                  onClick={() => setPreviewMode("reviewer")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    previewMode === "reviewer"
                      ? "bg-white text-indigo-600 shadow-xs dark:bg-gray-900 dark:text-indigo-400"
                      : "text-slate-600 dark:text-gray-400"
                  }`}
                >
                  Reviewer Full Audit View
                </button>
              </div>
            </div>

            {/* Candidate Header Simulation */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0c121e] space-y-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40">
                    {organization.name} • {difficulty.toUpperCase()}
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1.5">{title}</h3>
                  <p className="text-xs text-slate-600 dark:text-gray-300 mt-1">{description}</p>
                </div>
                <div className="text-right space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{attemptDurationMinutes}:00 Attempt Time</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono justify-end">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{submissionDeadlineDays} Days to Submit</span>
                  </div>
                </div>
              </div>

              {/* Task Navigation Stepper Preview */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Task Progression ({candidateScrubbedTasks.length} Sections)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {candidateScrubbedTasks.map((task, idx) => (
                    <div
                      key={task.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/60 dark:bg-gray-900/40 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center font-mono">
                          {idx + 1}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 font-mono">
                          {task.points} Marks • {task.estimatedMinutes}m
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">{task.title}</h4>
                      <p className="text-[10px] text-slate-500 line-clamp-2">{task.description}</p>

                      <div className="pt-1 flex items-center justify-between text-[10px]">
                        <span
                          className={`font-semibold ${
                            task.aiPolicy?.mode === "prohibited"
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {task.aiPolicy?.mode === "prohibited" ? "AI Prohibited" : "AI Enabled"}
                        </span>
                        {previewMode === "candidate" && task.type === "coding_challenge" && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            <span>Hidden Tests Scrubbed</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setActiveStep("publish")}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <span>Proceed to Version Publishing</span>
                <UploadCloud className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: 1-CLICK PUBLISHING & SEMANTIC VERSIONING */}
        {/* ========================================================================= */}
        {activeStep === "publish" && (
          <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto space-y-6">
            <div className="border-b border-slate-200 dark:border-gray-800 pb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-500" />
                <span>Publish Assessment Version</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                Published versions are permanently immutable and cryptographically fingerprinted with SHA-256. Candidates assigned to this version stay pinned permanently.
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-indigo-950 dark:text-indigo-200 block">
                    Version Bump Strategy
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-gray-400">
                    Follows Semantic Versioning (SemVer) invariants
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {(["patch", "minor", "major"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setVersionType(type)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                        versionType === type
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="font-bold text-slate-800 dark:text-gray-200">
                  Version Changelog & Audit Summary
                </label>
                <textarea
                  rows={4}
                  value={changelogNotes}
                  onChange={(e) => setChangelogNotes(e.target.value)}
                  placeholder="Summarize reasons for this release, changes to rubrics, or added tasks..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs"
                />
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-indigo-100 dark:border-gray-800 space-y-1 text-xs">
                <span className="font-bold text-slate-700 dark:text-gray-300 block">
                  Publishing Invariants Check:
                </span>
                <ul className="space-y-1 text-[11px] text-slate-500 dark:text-gray-400">
                  <li className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Total {tasks.length} tasks validated ({totalPoints} marks total)</span>
                  </li>
                  <li className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Attempt duration ({attemptDurationMinutes}m) and deadline window ({submissionDeadlineDays}d) separated</span>
                  </li>
                  <li className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Hidden test cases scrubbed from candidate client distribution</span>
                  </li>
                  <li className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>AI token usage strictly decoupled from candidate competence scoring</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-gray-800 text-xs font-semibold text-slate-700 dark:text-gray-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handlePublishImmutable}
                disabled={isPublishing}
                className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/25 flex items-center gap-2 cursor-pointer transition-all"
              >
                <UploadCloud className="w-4 h-4" />
                <span>{isPublishing ? "Publishing Version..." : "Confirm & Publish Immutable Version"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
