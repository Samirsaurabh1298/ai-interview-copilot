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
      // Generate harness file combining security traps, solution, and tests
      const harnessCode = `
// === Security Sandbox Trap Layer ===
const __blockedNetwork = (api: string) => {
  throw new Error("SecurityException: Outbound network calls (" + api + ") are prohibited inside assessment sandbox.");
};

globalThis.fetch = (() => __blockedNetwork("fetch")) as any;
if (typeof WebSocket !== "undefined") {
  globalThis.WebSocket = function() { __blockedNetwork("WebSocket"); } as any;
}

// Neuter core network modules
try {
  const http = await import("node:http");
  (http.default as any).request = () => __blockedNetwork("http.request");
  (http.default as any).get = () => __blockedNetwork("http.get");
} catch {}

try {
  const https = await import("node:https");
  (https.default as any).request = () => __blockedNetwork("https.request");
  (https.default as any).get = () => __blockedNetwork("https.get");
} catch {}

try {
  const net = await import("node:net");
  (net.default as any).connect = () => __blockedNetwork("net.connect");
  (net.default as any).createConnection = () => __blockedNetwork("net.createConnection");
  (net.default as any).Socket.prototype.connect = function() { __blockedNetwork("net.Socket.connect"); };
} catch {}

try {
  const dgram = await import("node:dgram");
  (dgram.default as any).createSocket = () => __blockedNetwork("dgram.createSocket");
} catch {}

// Prevent candidate code from hijacking process.exit before test suite finishes
const __realProcessExit = process.exit.bind(process);
let __canExit = false;
process.exit = ((code?: number) => {
  if (!__canExit) {
    throw new Error("SecurityException: Calling process.exit() directly inside assessment solution is prohibited.");
  }
  return __realProcessExit(code);
}) as any;

const __tests: { name: string; fn: () => void | Promise<void> }[] = [];
function test(name: string, fn: () => void | Promise<void>) {
  __tests.push({ name, fn });
}

// === Candidate Code ===
${request.code}

// === Test Suite ===
${request.testCode}

// === Test Execution Harness ===
async function run() {
  const results: any[] = [];
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
  __canExit = true;
  process.exit(allPassed && results.length > 0 ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  __canExit = true;
  process.exit(1);
});
`;
      fs.writeFileSync(scriptPath, harnessCode, "utf8");
      binary = process.execPath; // node
      args = [
        "--permission",
        "--allow-fs-read=*",
        `--allow-fs-write=${tmpDir}`,
        "--disallow-code-generation-from-strings",
        "--no-addons",
        "--no-warnings",
        "--experimental-strip-types",
        `--max-old-space-size=${request.memoryLimitMb || 64}`,
        scriptPath,
      ];
    } else if (request.language === "python") {
      scriptPath = path.join(tmpDir, "runner.py");
      const harnessCode = `
import time
import sys
import json

# === Security Sandbox Trap Layer ===
class BlockedSecurityModule:
    def __getattr__(self, name):
        raise RuntimeError("SecurityException: Access to network or subprocess modules is prohibited in sandbox.")

for mod in ["socket", "urllib", "urllib.request", "requests", "http", "http.client", "subprocess", "multiprocessing"]:
    sys.modules[mod] = BlockedSecurityModule()

try:
    import os
    os.system = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("SecurityException: Process execution is prohibited."))
    os.popen = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("SecurityException: Process execution is prohibited."))
except Exception:
    pass

__real_exit = sys.exit
__can_exit = False
def safe_exit(code=0):
    if not __can_exit:
        raise RuntimeError("SecurityException: Calling sys.exit() directly inside assessment solution is prohibited.")
    __real_exit(code)
sys.exit = safe_exit

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
__can_exit = True
sys.exit(0 if (all_passed and len(results) > 0) else 1)
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

    const allTestsPassed = tests.length > 0 && tests.every((t) => t.passed);

    return {
      success: true,
      passed: executionResult.exitCode === 0 && allTestsPassed,
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

