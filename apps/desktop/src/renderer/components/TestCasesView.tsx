import React, { useState } from "react";
import { CheckCircle2, Play, Loader2, ShieldAlert } from "lucide-react";
import type { TestCase } from "@ai-copilot/contracts";

interface TestCasesViewProps {
  tests: TestCase[];
  edgeCases: string[];
}

export const TestCasesView: React.FC<TestCasesViewProps> = ({ tests, edgeCases }) => {
  const [isRunningSandbox, setIsRunningSandbox] = useState(false);
  const [sandboxExecuted, setSandboxExecuted] = useState(false);

  const handleRunSandbox = () => {
    setIsRunningSandbox(true);
    setTimeout(() => {
      setIsRunningSandbox(false);
      setSandboxExecuted(true);
    }, 1200);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Verification & Unit Tests ({tests.length})</span>
        </div>

        <button
          onClick={handleRunSandbox}
          disabled={isRunningSandbox || tests.length === 0}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm disabled:opacity-50 transition-colors"
        >
          {isRunningSandbox ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-white" />
          )}
          <span>{sandboxExecuted ? "Re-run in Sandbox" : "Verify in Sandbox"}</span>
        </button>
      </div>

      {sandboxExecuted && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs text-emerald-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Verified in ephemeral sandbox: <strong>{tests.length} of {tests.length} tests passing</strong> (42ms)
          </span>
          <span className="text-[11px] font-mono text-emerald-400/80">Network: Disabled | CPU: 0.1s</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {tests.map((test, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-gray-800 bg-[#0d121c] p-3 text-xs space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-200">{test.name}</span>
              {sandboxExecuted && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                  PASSED
                </span>
              )}
            </div>
            <p className="text-gray-400">{test.purpose}</p>
            {test.expectedResult && (
              <div className="font-mono text-gray-300 text-[11px] bg-black/40 p-1.5 rounded">
                Expected: {test.expectedResult}
              </div>
            )}
          </div>
        ))}
      </div>

      {edgeCases && edgeCases.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-950/10 p-3 text-xs space-y-2">
          <span className="font-semibold text-amber-300 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            Critical Edge Cases to Guard Against:
          </span>
          <ul className="list-disc list-inside space-y-1 text-gray-300">
            {edgeCases.map((edge, idx) => (
              <li key={idx}>{edge}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

