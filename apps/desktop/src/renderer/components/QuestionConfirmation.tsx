import React, { useState } from "react";
import { Play, ArrowLeft, AlertCircle, FileCode, Sliders, FolderGit2, Cpu, Check } from "lucide-react";
import type { TaskType, ResponseStyle, AIRequest, ContextItem } from "@ai-copilot/contracts";

interface QuestionConfirmationProps {
  initialQuestion: string;
  initialCode?: string | undefined;
  initialLanguage?: string | undefined;
  onCancel: () => void;
  onSubmit: (request: AIRequest, providerId?: string) => void;
  isSubmitting: boolean;
}

export const QuestionConfirmation: React.FC<QuestionConfirmationProps> = ({
  initialQuestion,
  initialCode = "",
  initialLanguage = "typescript",
  onCancel,
  onSubmit,
  isSubmitting,
}) => {
  const [question, setQuestion] = useState(initialQuestion);
  const [code, setCode] = useState(initialCode);
  const [task, setTask] = useState<TaskType>("debug");
  const [language, setLanguage] = useState(initialLanguage);
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>("concise");
  const [selectedProvider, setSelectedProvider] = useState<string>("groq");

  // Repository Context state
  const [repoPath, setRepoPath] = useState("");
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexedFilesCount, setIndexedFilesCount] = useState<number | null>(null);
  const [attachedContext, setAttachedContext] = useState<ContextItem[]>([]);

  const handleIndexRepository = async () => {
    if (!repoPath.trim()) return;
    setIsIndexing(true);
    try {
      const res = await fetch("http://localhost:4000/api/v1/context/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directoryPath: repoPath.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setIndexedFilesCount(data.totalFiles);

        // Auto-retrieve relevant context for the current question
        const retRes = await fetch("http://localhost:4000/api/v1/context/retrieve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: question, maxFiles: 4 }),
        });
        const retData = await retRes.json();
        if (retRes.ok && retData.items) {
          setAttachedContext(retData.items);
        }
      }
    } catch (err) {
      console.error("Failed to index repository", err);
    } finally {
      setIsIndexing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    onSubmit(
      {
        task,
        question: question.trim(),
        code: code.trim() || undefined,
        language: language.trim() || undefined,
        responseStyle,
        context: attachedContext,
      },
      selectedProvider
    );
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Back button and notice */}
      <div className="flex items-center justify-between">
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to capture</span>
        </button>
        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Human-in-the-loop: Review and correct extracted content before sending</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5 transition-colors dark:border-gray-800 dark:bg-[#111827]">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-gray-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Review & Configure Analysis</h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Fix any OCR inaccuracies, select provider, and optionally attach repository context.
              </p>
            </div>

            {/* Task Type and Provider Selectors */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <label htmlFor="provider-select" className="text-xs font-medium text-slate-600 dark:text-gray-400">
                  Model:
                </label>
                <select
                  id="provider-select"
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="groq">Groq LPU (Ultra-Fast)</option>
                  <option value="anthropic">Claude 3.5 Sonnet</option>
                  <option value="google">Gemini 2.0 Flash</option>
                  <option value="openai">GPT-4o</option>
                  <option value="mock">Deterministic Mock</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <label htmlFor="task-select" className="text-xs font-medium text-slate-600 dark:text-gray-400">
                  Task:
                </label>
                <select
                  id="task-select"
                  value={task}
                  onChange={(e) => setTask(e.target.value as TaskType)}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="debug">Debug & Find Defect</option>
                  <option value="explain">Explain & Trace Flow</option>
                  <option value="implement">Implement Behavior</option>
                  <option value="refactor">Refactor & Optimize</option>
                  <option value="test">Generate Unit Tests</option>
                  <option value="mock-interview">Mock Interview Follow-up</option>
                </select>
              </div>
            </div>
          </div>

          {/* Editable Question Statement */}
          <div className="space-y-2">
            <label htmlFor="question-edit" className="block text-xs font-medium text-slate-700 dark:text-gray-300">
              Problem Statement / Interview Question:
            </label>
            <textarea
              id="question-edit"
              rows={5}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans leading-relaxed dark:border-gray-800 dark:bg-gray-900/90 dark:text-gray-100 dark:placeholder-gray-500"
              required
            />
          </div>

          {/* Optional Code Snippet */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="code-edit" className="text-xs font-medium text-slate-700 flex items-center gap-1.5 dark:text-gray-300">
                <FileCode className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span>Code Snippet / Unfamiliar Function (Optional):</span>
              </label>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-gray-400">Language:</span>
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="typescript"
                  className="w-24 rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>

            <textarea
              id="code-edit"
              rows={7}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste function implementation or extracted code block here..."
              className="w-full rounded-lg border border-slate-800 bg-slate-900 p-3 font-mono text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 dark:placeholder-gray-600"
            />
          </div>

          {/* Repository Context Engine (Journey B) */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5 dark:border-gray-800 dark:bg-gray-900/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 dark:text-gray-300">
                <FolderGit2 className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                <span>Repository Context Engine (Optional)</span>
              </span>
              {indexedFilesCount !== null && (
                <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 dark:text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  {indexedFilesCount} files indexed ({attachedContext.length} snippets attached)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                placeholder="C:/path/to/project (excludes .git, .env, and node_modules)"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:placeholder-gray-600"
              />
              <button
                type="button"
                onClick={handleIndexRepository}
                disabled={isIndexing || !repoPath.trim()}
                className="rounded-lg bg-slate-200 hover:bg-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 transition-colors disabled:opacity-50 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white"
              >
                {isIndexing ? "Indexing..." : "Index & Retrieve"}
              </button>
            </div>
          </div>

          {/* Options toolbar */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs dark:border-gray-800">
            <div className="flex items-center gap-4 text-slate-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5" />
                <span>Response Mode:</span>
                <button
                  type="button"
                  onClick={() => setResponseStyle("concise")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    responseStyle === "concise"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white"
                  }`}
                >
                  Concise (Fast)
                </button>
                <button
                  type="button"
                  onClick={() => setResponseStyle("detailed")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    responseStyle === "detailed"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white"
                  }`}
                >
                  Deep Architectural
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !question.trim()}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{isSubmitting ? "Orchestrating..." : `Analyze with ${selectedProvider.toUpperCase()}`}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
