import React from "react";
import {
  RotateCcw,
  CheckCircle,
  HelpCircle,
  Clock,
  HardDrive,
  Copy,
  Info,
  Sparkles,
} from "lucide-react";
import type { AIResponse } from "@ai-copilot/contracts";
import { DiffViewer } from "./DiffViewer.js";
import { TestCasesView } from "./TestCasesView.js";

interface AnswerViewProps {
  answer: AIResponse;
  onReset: () => void;
}

export const AnswerView: React.FC<AnswerViewProps> = ({ answer, onReset }) => {
  const [copiedCode, setCopiedCode] = React.useState(false);

  const copyCode = () => {
    if (!answer.code) return;
    navigator.clipboard.writeText(answer.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6 pb-20">
      {/* Top Banner / Actions */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold uppercase tracking-wider">
            {answer.category}
          </span>
          <span className="text-xs text-gray-400">
            Provider: <strong className="text-gray-200">{answer.provider}</strong> ({answer.model})
          </span>
          {answer.confidence !== undefined && (
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Confidence: {Math.round(answer.confidence * 100)}%
            </span>
          )}
        </div>

        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-gray-800 hover:bg-gray-800"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>New Question</span>
        </button>
      </div>

      {/* Primary Explanation Card */}
      <div className="rounded-xl border border-gray-800 bg-[#111827] p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-base font-semibold text-white">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Engineering Diagnosis & Explanation</span>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed font-sans">{answer.explanation}</p>

        {/* Complexity metrics */}
        {(answer.timeComplexity || answer.spaceComplexity) && (
          <div className="flex items-center gap-6 pt-3 border-t border-gray-800/80 text-xs">
            {answer.timeComplexity && (
              <div className="flex items-center gap-2 text-gray-300">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>
                  Time Complexity: <strong>{answer.timeComplexity}</strong>
                </span>
              </div>
            )}
            {answer.spaceComplexity && (
              <div className="flex items-center gap-2 text-gray-300">
                <HardDrive className="w-4 h-4 text-purple-400" />
                <span>
                  Space Complexity: <strong>{answer.spaceComplexity}</strong>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assumptions & Diagnosis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {answer.assumptions && answer.assumptions.length > 0 && (
          <div className="rounded-xl border border-gray-800 bg-[#111827] p-5 space-y-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              Verified Assumptions
            </span>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-gray-300">
              {answer.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {answer.diagnosis && answer.diagnosis.length > 0 && (
          <div className="rounded-xl border border-gray-800 bg-[#111827] p-5 space-y-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              Identified Root Causes
            </span>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-gray-300">
              {answer.diagnosis.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Step by Step Approach */}
      {answer.approach && answer.approach.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-[#111827] p-5 space-y-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Step-by-Step Approach
          </span>
          <div className="space-y-2">
            {answer.approach.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-gray-300">
                <span className="w-5 h-5 rounded-full bg-indigo-600/20 text-indigo-400 font-semibold flex items-center justify-center text-[10px] shrink-0 border border-indigo-500/30">
                  {idx + 1}
                </span>
                <span className="pt-0.5 leading-relaxed">{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Code Changes / Unified Diff */}
      {answer.codeChanges && answer.codeChanges.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-[#111827] p-6 shadow-xl">
          <DiffViewer changes={answer.codeChanges} />
        </div>
      )}

      {/* Complete Solution Code if provided */}
      {answer.code && (
        <div className="rounded-xl border border-gray-800 bg-[#111827] overflow-hidden shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/60 px-6 py-3 text-xs">
            <span className="font-semibold text-gray-300">Full Verified Code Solution</span>
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"
            >
              {copiedCode ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Solution</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-6 font-mono text-xs text-gray-200 overflow-x-auto bg-[#090d16] leading-relaxed">
            {answer.code}
          </pre>
        </div>
      )}

      {/* Tests & Edge Cases */}
      {answer.tests && (
        <div className="rounded-xl border border-gray-800 bg-[#111827] p-6 shadow-xl">
          <TestCasesView tests={answer.tests} edgeCases={answer.edgeCases} />
        </div>
      )}

      {/* Follow-up Interview Questions */}
      {answer.followUpQuestions && answer.followUpQuestions.length > 0 && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/10 p-5 space-y-3">
          <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-indigo-400" />
            Interviewer Follow-Up Questions (Practice Mode):
          </span>
          <div className="space-y-2">
            {answer.followUpQuestions.map((q, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-indigo-500/20 bg-gray-900/40 p-3 text-xs text-gray-200 flex items-start gap-2.5"
              >
                <span className="font-semibold text-indigo-400 shrink-0">Q{idx + 1}:</span>
                <span>{q}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

