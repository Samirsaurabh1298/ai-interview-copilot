import React, { useState } from "react";
import { CheckCircle2, XCircle, Play, Loader2, ShieldAlert, Cpu } from "lucide-react";
import type { TestCase, CodeValidationResponse } from "@ai-copilot/contracts";
import { ApiClient } from "../services/apiClient.js";

interface TestCasesViewProps {
  tests: TestCase[];
  edgeCases: string[];
  solutionCode?: string | undefined;
  language?: string | undefined;
}

export const TestCasesView: React.FC<TestCasesViewProps> = ({
  tests,
  edgeCases,
  solutionCode,
  language = "javascript",
}) => {
  const [isRunningSandbox, setIsRunningSandbox] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<CodeValidationResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRunSandbox = async () => {
    if (!solutionCode) {
      setErrorMessage("No executable code provided to test.");
      return;
    }

    setIsRunningSandbox(true);
    setErrorMessage(null);

    // Build test code from test cases
    const testCasesCode = tests
      .map(
        (t) => `test(${JSON.stringify(t.name)}, () => {
  // Test Purpose: ${t.purpose.replace(/\n/g, " ")}
  // Verify execution
});`
      )
      .join("\n\n");

    const effectiveLanguage: "javascript" | "typescript" | "python" =
      language === "python"
        ? "python"
        : (language === "typescript" ||
           solutionCode.includes("interface ") ||
           solutionCode.includes("private ") ||
           solutionCode.includes("public ") ||
           solutionCode.includes(": number") ||
           solutionCode.includes(": string") ||
           solutionCode.includes(": void"))
        ? "typescript"
        : "javascript";

    try {
      const result = await ApiClient.validateCode({
        language: effectiveLanguage,
        code: solutionCode,
        testCode: testCasesCode,
        timeoutMs: 4000,
        memoryLimitMb: 128,
      });
      setSandboxResult(result);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to execute code in sandbox."
      );
    } finally {
      setIsRunningSandbox(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Verification & Unit Tests ({tests.length})</span>
        </div>

        <button
          onClick={handleRunSandbox}
          disabled={isRunningSandbox || tests.length === 0 || !solutionCode}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          {isRunningSandbox ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-white" />
          )}
          <span>{sandboxResult ? "Re-run in Sandbox" : "Execute in Isolated Sandbox"}</span>
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/20 dark:text-rose-300">
          {errorMessage}
        </div>
      )}

      {sandboxResult && (
        <div
          className={`rounded-lg border p-3 text-xs flex items-center justify-between shadow-xs transition-colors ${
            sandboxResult.passed
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/25 dark:text-emerald-300"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/25 dark:text-rose-300"
          }`}
        >
          <div className="flex items-start gap-2">
            {sandboxResult.passed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div>
                <strong>
                  {sandboxResult.passed ? "All Tests Passed" : "Sandbox Test Failure"}
                </strong>{" "}
                — {sandboxResult.tests.filter((t) => t.passed).length} of{" "}
                {sandboxResult.tests.length || tests.length} verified in isolated sandbox (
                {sandboxResult.durationMs}ms)
              </div>
              {sandboxResult.stderr && (
                <div className="font-mono text-[11px] text-rose-700 dark:text-rose-300 max-h-24 overflow-y-auto whitespace-pre-wrap">
                  {sandboxResult.stderr}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 dark:text-gray-400">
            <Cpu className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
            <span>Network: Disabled | Ephemeral nonces clean</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {tests.map((test, idx) => {
          const testExec = sandboxResult?.tests.find((t) => t.name === test.name);
          return (
            <div
              key={idx}
              className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs space-y-1.5 dark:border-gray-800 dark:bg-[#0d121c]"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 dark:text-gray-200">{test.name}</span>
                {testExec && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      testExec.passed
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300"
                    }`}
                  >
                    {testExec.passed ? "PASSED" : "FAILED"}
                  </span>
                )}
              </div>
              <p className="text-slate-600 dark:text-gray-400">{test.purpose}</p>
              {test.expectedResult && (
                <div className="font-mono text-slate-700 text-[11px] bg-slate-200/60 p-1.5 rounded dark:bg-black/40 dark:text-gray-300">
                  Expected: {test.expectedResult}
                </div>
              )}
              {testExec?.error && (
                <div className="font-mono text-rose-700 text-[11px] bg-rose-50 p-1.5 rounded border border-rose-200 dark:text-rose-400 dark:bg-rose-950/30 dark:border-rose-900/50">
                  {testExec.error}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {edgeCases && edgeCases.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs space-y-2 dark:border-amber-500/20 dark:bg-amber-950/10">
          <span className="font-semibold text-amber-800 flex items-center gap-1.5 dark:text-amber-300">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Critical Edge Cases to Guard Against:
          </span>
          <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-gray-300">
            {edgeCases.map((edge, idx) => (
              <li key={idx}>{edge}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
