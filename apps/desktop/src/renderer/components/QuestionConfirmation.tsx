import React, { useState } from "react";
import { Play, ArrowLeft, AlertCircle, FileCode, Sliders } from "lucide-react";
import type { TaskType, ResponseStyle, AIRequest } from "@ai-copilot/contracts";

interface QuestionConfirmationProps {
  initialQuestion: string;
  initialCode?: string | undefined;
  initialLanguage?: string | undefined;
  onCancel: () => void;
  onSubmit: (request: AIRequest) => void;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    onSubmit({
      task,
      question: question.trim(),
      code: code.trim() || undefined,
      language: language.trim() || undefined,
      responseStyle,
      context: [],
    });
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Back button and notice */}
      <div className="flex items-center justify-between">
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to capture</span>
        </button>
        <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Human-in-the-loop: Review and correct extracted content before sending</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-gray-800 bg-[#111827] p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-gray-800 pb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Review & Confirm Problem</h2>
              <p className="text-xs text-gray-400">
                Fix any OCR inaccuracies and select the desired engineering assistance task.
              </p>
            </div>

            {/* Task Type Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="task-select" className="text-xs font-medium text-gray-400">
                Task Type:
              </label>
              <select
                id="task-select"
                value={task}
                onChange={(e) => setTask(e.target.value as TaskType)}
                className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-medium text-white focus:border-indigo-500 focus:outline-none"
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

          {/* Editable Question Statement */}
          <div className="space-y-2">
            <label htmlFor="question-edit" className="block text-xs font-medium text-gray-300">
              Problem Statement / Interview Question:
            </label>
            <textarea
              id="question-edit"
              rows={5}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full rounded-lg border border-gray-800 bg-gray-900/90 p-3 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans leading-relaxed"
              required
            />
          </div>

          {/* Optional Code Snippet */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="code-edit" className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                <span>Code Snippet / Unfamiliar Function (Optional):</span>
              </label>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Language:</span>
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="typescript"
                  className="w-24 rounded border border-gray-700 bg-gray-800 px-2 py-0.5 text-xs text-white"
                />
              </div>
            </div>

            <textarea
              id="code-edit"
              rows={8}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste function implementation or extracted code block here..."
              className="w-full rounded-lg border border-gray-800 bg-gray-950 p-3 font-mono text-xs text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Options toolbar */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-800 text-xs">
            <div className="flex items-center gap-4 text-gray-400">
              <div className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5" />
                <span>Response Mode:</span>
                <button
                  type="button"
                  onClick={() => setResponseStyle("concise")}
                  className={`px-2.5 py-1 rounded font-medium ${
                    responseStyle === "concise"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  Concise (Fast)
                </button>
                <button
                  type="button"
                  onClick={() => setResponseStyle("detailed")}
                  className={`px-2.5 py-1 rounded font-medium ${
                    responseStyle === "detailed"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  Deep Architectural
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !question.trim()}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{isSubmitting ? "Orchestrating AI..." : "Generate Structured Analysis"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

