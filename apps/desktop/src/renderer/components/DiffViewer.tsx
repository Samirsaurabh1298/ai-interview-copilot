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
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <GitCommit className="w-4 h-4 text-indigo-400" />
        <span>Proposed Minimal Code Changes ({changes.length})</span>
      </div>

      <div className="space-y-3">
        {changes.map((change, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-gray-800 bg-[#0c1017] overflow-hidden shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-gray-800/80 bg-gray-900/60 px-4 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium text-indigo-300">
                  {change.path ?? `Change #${idx + 1}`}
                </span>
                <span className="text-gray-400">— {change.description}</span>
              </div>
              {change.diff && (
                <button
                  onClick={() => copyDiff(change.diff!, idx)}
                  className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
                  aria-label="Copy diff"
                >
                  {copiedIndex === idx ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
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
              <pre className="p-4 font-mono text-xs overflow-x-auto text-gray-300 leading-relaxed">
                {change.diff.split("\n").map((line, lIdx) => {
                  let lineStyle = "text-gray-400";
                  if (line.startsWith("+")) {
                    lineStyle = "text-emerald-400 bg-emerald-950/30 -mx-4 px-4 block";
                  } else if (line.startsWith("-")) {
                    lineStyle = "text-rose-400 bg-rose-950/30 -mx-4 px-4 block";
                  } else if (line.startsWith("@@")) {
                    lineStyle = "text-cyan-400 font-semibold";
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

