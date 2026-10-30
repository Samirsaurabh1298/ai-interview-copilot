import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type {
  CodeValidationRequest,
  CodeValidationResponse,
  SingleTestResult,
} from "@ai-copilot/contracts";

export async function executeCodeInSandbox(
  request: CodeValidationRequest
): Promise<CodeValidationResponse> {
  const startTime = Date.now();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-copilot-sandbox-"));

  try {
    let scriptPath: string;
    let binary: string;
    let args: string[];

    if (request.language === "javascript" || request.language === "typescript") {
      // Use runner.ts with Node's native strip-types support to seamlessly execute both TS and JS
      scriptPath = path.join(tmpDir, "runner.ts");
      // Generate harness file combining solution and tests
      const harnessCode = `
const __tests = [];
function test(name, fn) {
  __tests.push({ name, fn });
}

// === Candidate Code ===
${request.code}

// === Test Suite ===
${request.testCode}

// === Test Execution Harness ===
async function run() {
  const results = [];
  let allPassed = true;
  for (const t of __tests) {
    const start = performance.now();
    try {
      await t.fn();
      results.push({ name: t.name, passed: true, durationMs: Math.round(performance.now() - start) });
    } catch (err) {
      allPassed = false;
      results.push({
        name: t.name,
        passed: false,
        durationMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
  console.log("###RESULTS_START###" + JSON.stringify(results) + "###RESULTS_END###");
  process.exit(allPassed ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
`;
      fs.writeFileSync(scriptPath, harnessCode, "utf8");
      binary = process.execPath; // node
      args = [
        "--no-warnings",
        "--experimental-strip-types",
        `--max-old-space-size=${request.memoryLimitMb}`,
        "--no-addons",
        scriptPath,
      ];
    } else if (request.language === "python") {
      scriptPath = path.join(tmpDir, "runner.py");
      const harnessCode = `
import time
import sys
import json

__tests = []
def test(name, fn):
    __tests.append((name, fn))

# === Candidate Code ===
${request.code}

# === Test Suite ===
${request.testCode}

# === Test Execution Harness ===
results = []
all_passed = True

for name, fn in __tests:
    start = time.perf_counter()
    try:
        fn()
        dur = round((time.perf_counter() - start) * 1000, 2)
        results.append({"name": name, "passed": True, "durationMs": dur})
    except Exception as e:
        all_passed = False
        dur = round((time.perf_counter() - start) * 1000, 2)
        results.append({"name": name, "passed": False, "durationMs": dur, "error": str(e)})

print("###RESULTS_START###" + json.dumps(results) + "###RESULTS_END###")
sys.exit(0 if all_passed else 1)
`;
      fs.writeFileSync(scriptPath, harnessCode, "utf8");
      binary = "python";
      args = ["-u", scriptPath];
    } else {
      throw new Error(`Unsupported sandbox language: ${request.language}`);
    }

    // Spawn isolated subprocess with stripped environment
    const executionResult = await runProcessIsolated({
      binary,
      args,
      cwd: tmpDir,
      timeoutMs: request.timeoutMs,
      // CRITICAL: Scrub all secrets and sensitive environment variables
      env: {
        PATH: process.env.PATH || "",
        NODE_ENV: "test",
        PYTHONIOENCODING: "utf-8",
      },
    });

    const durationMs = Date.now() - startTime;

    // Parse structured test results from harness output
    let tests: SingleTestResult[] = [];
    const match = executionResult.stdout.match(/###RESULTS_START###(.*?)###RESULTS_END###/);
    if (match && match[1]) {
      try {
        tests = JSON.parse(match[1]);
      } catch {
        // Fallback if parsing fails
      }
    }

    // Clean marker strings from stdout
    const cleanedStdout = executionResult.stdout
      .replace(/###RESULTS_START###.*?###RESULTS_END###/, "")
      .trim();

    return {
      success: true,
      passed: executionResult.exitCode === 0,
      exitCode: executionResult.exitCode,
      stdout: cleanedStdout,
      stderr: executionResult.stderr.trim(),
      durationMs,
      tests,
      sandboxed: true,
      error: executionResult.error,
    };
  } finally {
    // Guaranteed cleanup of ephemeral sandbox directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore temporary cleanup errors
    }
  }
}

interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  error?: string;
}

function runProcessIsolated(opts: {
  binary: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  env: NodeJS.ProcessEnv;
}): Promise<ProcessResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let killedByTimeout = false;

    const child = spawn(opts.binary, opts.args, {
      cwd: opts.cwd,
      env: opts.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      killedByTimeout = true;
      try {
        child.kill("SIGKILL");
      } catch {
        // Process might have terminated
      }
    }, opts.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < 65536) {
        stdout += chunk.toString("utf8");
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 65536) {
        stderr += chunk.toString("utf8");
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        exitCode: 1,
        stdout,
        stderr: stderr || err.message,
        error: `Failed to spawn runner process: ${err.message}`,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (killedByTimeout) {
        resolve({
          exitCode: 124,
          stdout,
          stderr: stderr + "\nProcess timed out and was killed by sandbox watchdog.",
          error: `Execution timed out after ${opts.timeoutMs}ms`,
        });
      } else {
        resolve({
          exitCode: code ?? 0,
          stdout,
          stderr,
        });
      }
    });
  });
}

