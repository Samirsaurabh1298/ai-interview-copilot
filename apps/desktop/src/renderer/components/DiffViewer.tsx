import React from "react";
import { GitCommit, Copy, Check } from "lucide-react";
import type { CodeChange } from "@ai-copilot/contracts";

interface DiffViewerProps {
  changes: CodeChange[];
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ changes }) => {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  const copyDiff = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!changes || changes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        <GitCommit className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
        <span>Proposed Minimal Code Changes ({changes.length})</span>
      </div>

      <div className="space-y-3">
        {changes.map((change, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs dark:border-gray-800 dark:bg-[#0c1017]"
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs dark:border-gray-800/80 dark:bg-gray-900/60">
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium text-indigo-600 dark:text-indigo-300">
                  {change.path ?? `Change #${idx + 1}`}
                </span>
                <span className="text-slate-500 dark:text-gray-400">— {change.description}</span>
              </div>
              {change.diff && (
                <button
                  onClick={() => copyDiff(change.diff!, idx)}
                  className="flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors dark:text-gray-400 dark:hover:text-white"
                  aria-label="Copy diff"
                >
                  {copiedIndex === idx ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Diff</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {change.diff && (
              <pre className="p-4 font-mono text-xs overflow-x-auto text-slate-700 leading-relaxed dark:text-gray-300">
                {change.diff.split("\n").map((line, lIdx) => {
                  let lineStyle = "text-slate-600 dark:text-gray-400";
                  if (line.startsWith("+")) {
                    lineStyle = "text-emerald-700 bg-emerald-50 font-medium dark:text-emerald-400 dark:bg-emerald-950/30 -mx-4 px-4 block";
                  } else if (line.startsWith("-")) {
                    lineStyle = "text-rose-700 bg-rose-50 font-medium dark:text-rose-400 dark:bg-rose-950/30 -mx-4 px-4 block";
                  } else if (line.startsWith("@@")) {
                    lineStyle = "text-cyan-700 font-semibold dark:text-cyan-400";
                  }
                  return (
                    <span key={lIdx} className={lineStyle}>
                      {line}
                      {"\n"}
                    </span>
                  );
                })}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
