import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type {
  CodeValidationRequest,
  CodeValidationResponse,
  SingleTestResult,
  LanguageRuntimeProfile,
} from "@ai-copilot/contracts";

export function executePolyglotCompiler(
  request: CodeValidationRequest,
  profile: LanguageRuntimeProfile
): CodeValidationResponse {
  const lang = request.language.toLowerCase().trim();
  const startTime = Date.now();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `ai-copilot-compiler-${lang}-`));

  try {
    switch (lang) {
      case "go":
        return executeGoCompiler(request, profile, tmpDir, startTime);
      case "java":
        return executeJavaCompiler(request, profile, tmpDir, startTime);
      case "cpp":
        return executeCppCompiler(request, profile, tmpDir, startTime);
      case "rust":
        return executeRustCompiler(request, profile, tmpDir, startTime);
      default:
        return {
          success: false,
          passed: false,
          exitCode: 1,
          stdout: "",
          stderr: `Unsupported compiler language: ${request.language}`,
          durationMs: Date.now() - startTime,
          tests: [],
          sandboxed: true,
          error: `Unsupported compiler language: ${request.language}`,
        };
    }
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

// 1. Go Compiler Runner (go test)
function executeGoCompiler(
  request: CodeValidationRequest,
  profile: LanguageRuntimeProfile,
  tmpDir: string,
  startTime: number
): CodeValidationResponse {
  // Check if go compiler binary exists
  const hasGo = checkBinaryExists("go");
  if (!hasGo) {
    return {
      success: false,
      passed: false,
      exitCode: 127,
      stdout: "",
      stderr: "COMPILER_NOT_FOUND: Go compiler toolchain ('go') is not installed in current execution environment.",
      durationMs: Date.now() - startTime,
      tests: [],
      sandboxed: true,
      error: "COMPILER_NOT_FOUND: 'go' binary not found",
    };
  }

  // Create go.mod
  fs.writeFileSync(
    path.join(tmpDir, "go.mod"),
    "module solution\n\ngo 1.23\n",
    "utf8"
  );

  // Write solution and test files
  fs.writeFileSync(path.join(tmpDir, "solution.go"), request.code, "utf8");
  fs.writeFileSync(path.join(tmpDir, "solution_test.go"), request.testCode, "utf8");

  // Run go test -v with network disabled (GOPROXY=off)
  const run = spawnSync("go", ["test", "-v", "."], {
    cwd: tmpDir,
    timeout: profile.compilationTimeoutMs + profile.executionTimeoutMs,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH || "",
      GOPATH: path.join(tmpDir, ".gopath"),
      GOCACHE: path.join(tmpDir, ".gocache"),
      GOPROXY: "off",
      GONOSUMDB: "*",
    },
    windowsHide: true,
  });

  const durationMs = Date.now() - startTime;
  const stdout = run.stdout || "";
  const stderr = run.stderr || "";

  const tests: SingleTestResult[] = [];
  const testLines = stdout.split("\n");
  for (const line of testLines) {
    const match = line.match(/^--- (PASS|FAIL):\s+(\S+)\s+\(([\d.]+)s\)/);
    if (match && match[1] && match[2] && match[3]) {
      const passed = match[1] === "PASS";
      const name = match[2];
      const dur = Math.round(parseFloat(match[3]) * 1000);
      tests.push({ name, passed, durationMs: dur, error: passed ? undefined : "Test assertion failed" });
    }
  }

  const passed = run.status === 0 && (tests.length === 0 || tests.every((t) => t.passed));

  return {
    success: run.status === 0,
    passed,
    exitCode: run.status ?? 1,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    durationMs,
    tests,
    sandboxed: true,
    error: run.error?.message,
  };
}

// 2. Java Compiler Runner (javac + java)
function executeJavaCompiler(
  request: CodeValidationRequest,
  profile: LanguageRuntimeProfile,
  tmpDir: string,
  startTime: number
): CodeValidationResponse {
  const hasJavac = checkBinaryExists("javac");
  if (!hasJavac) {
    return {
      success: false,
      passed: false,
      exitCode: 127,
      stdout: "",
      stderr: "COMPILER_NOT_FOUND: Java JDK compiler ('javac') is not installed in current execution environment.",
      durationMs: Date.now() - startTime,
      tests: [],
      sandboxed: true,
      error: "COMPILER_NOT_FOUND: 'javac' binary not found",
    };
  }

  // Write Solution.java and SolutionTest.java
  fs.writeFileSync(path.join(tmpDir, "Solution.java"), request.code, "utf8");
  fs.writeFileSync(path.join(tmpDir, "SolutionTest.java"), request.testCode, "utf8");

  // Compile
  const compile = spawnSync("javac", ["-d", ".", "Solution.java", "SolutionTest.java"], {
    cwd: tmpDir,
    timeout: profile.compilationTimeoutMs,
    encoding: "utf8",
    env: { PATH: process.env.PATH || "" },
    windowsHide: true,
  });

  if (compile.status !== 0) {
    return {
      success: false,
      passed: false,
      exitCode: compile.status ?? 1,
      stdout: compile.stdout || "",
      stderr: compile.stderr || "Java compilation failed",
      durationMs: Date.now() - startTime,
      tests: [],
      sandboxed: true,
      error: "COMPILATION_ERROR: javac failed to compile solution",
    };
  }

  // Execute
  const run = spawnSync("java", ["-cp", ".", "SolutionTest"], {
    cwd: tmpDir,
    timeout: profile.executionTimeoutMs,
    encoding: "utf8",
    env: { PATH: process.env.PATH || "" },
    windowsHide: true,
  });

  const durationMs = Date.now() - startTime;
  return {
    success: run.status === 0,
    passed: run.status === 0,
    exitCode: run.status ?? 1,
    stdout: (run.stdout || "").trim(),
    stderr: (run.stderr || "").trim(),
    durationMs,
    tests: [],
    sandboxed: true,
    error: run.error?.message,
  };
}

// 3. C++ Compiler Runner (g++)
function executeCppCompiler(
  request: CodeValidationRequest,
  profile: LanguageRuntimeProfile,
  tmpDir: string,
  startTime: number
): CodeValidationResponse {
  const hasGpp = checkBinaryExists("g++") || checkBinaryExists("clang++");
  const compiler = checkBinaryExists("g++") ? "g++" : "clang++";

  if (!hasGpp) {
    return {
      success: false,
      passed: false,
      exitCode: 127,
      stdout: "",
      stderr: "COMPILER_NOT_FOUND: C++ compiler ('g++' or 'clang++') is not installed in current execution environment.",
      durationMs: Date.now() - startTime,
      tests: [],
      sandboxed: true,
      error: "COMPILER_NOT_FOUND: C++ compiler not found",
    };
  }

  const solutionFile = path.join(tmpDir, "solution.cpp");
  const testFile = path.join(tmpDir, "test.cpp");
  const binaryFile = path.join(tmpDir, process.platform === "win32" ? "test_bin.exe" : "test_bin");

  fs.writeFileSync(solutionFile, request.code, "utf8");
  fs.writeFileSync(testFile, request.testCode, "utf8");

  // Compile
  const compile = spawnSync(compiler, ["-std=c++20", "-O2", solutionFile, testFile, "-o", binaryFile], {
    cwd: tmpDir,
    timeout: profile.compilationTimeoutMs,
    encoding: "utf8",
    env: { PATH: process.env.PATH || "" },
    windowsHide: true,
  });

  if (compile.status !== 0) {
    return {
      success: false,
      passed: false,
      exitCode: compile.status ?? 1,
      stdout: compile.stdout || "",
      stderr: compile.stderr || "C++ compilation failed",
      durationMs: Date.now() - startTime,
      tests: [],
      sandboxed: true,
      error: "COMPILATION_ERROR: C++ compiler failed to compile solution",
    };
  }

  // Execute binary
  const run = spawnSync(binaryFile, [], {
    cwd: tmpDir,
    timeout: profile.executionTimeoutMs,
    encoding: "utf8",
    windowsHide: true,
  });

  const durationMs = Date.now() - startTime;
  return {
    success: run.status === 0,
    passed: run.status === 0,
    exitCode: run.status ?? 1,
    stdout: (run.stdout || "").trim(),
    stderr: (run.stderr || "").trim(),
    durationMs,
    tests: [],
    sandboxed: true,
    error: run.error?.message,
  };
}

// 4. Rust Compiler Runner (cargo / rustc)
function executeRustCompiler(
  request: CodeValidationRequest,
  profile: LanguageRuntimeProfile,
  tmpDir: string,
  startTime: number
): CodeValidationResponse {
  const hasCargo = checkBinaryExists("cargo");
  if (!hasCargo) {
    return {
      success: false,
      passed: false,
      exitCode: 127,
      stdout: "",
      stderr: "COMPILER_NOT_FOUND: Rust toolchain ('cargo' / 'rustc') is not installed in current execution environment.",
      durationMs: Date.now() - startTime,
      tests: [],
      sandboxed: true,
      error: "COMPILER_NOT_FOUND: 'cargo' binary not found",
    };
  }

  // Initialize cargo project structure
  fs.writeFileSync(
    path.join(tmpDir, "Cargo.toml"),
    '[package]\nname = "solution"\nversion = "0.1.0"\nedition = "2021"\n',
    "utf8"
  );

  const srcDir = path.join(tmpDir, "src");
  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(path.join(srcDir, "lib.rs"), `${request.code}\n\n#[cfg(test)]\nmod tests {\n${request.testCode}\n}`, "utf8");

  // Run cargo test offline
  const run = spawnSync("cargo", ["test", "--offline", "--quiet"], {
    cwd: tmpDir,
    timeout: profile.compilationTimeoutMs + profile.executionTimeoutMs,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH || "",
      CARGO_HOME: path.join(tmpDir, ".cargo"),
    },
    windowsHide: true,
  });

  const durationMs = Date.now() - startTime;
  return {
    success: run.status === 0,
    passed: run.status === 0,
    exitCode: run.status ?? 1,
    stdout: (run.stdout || "").trim(),
    stderr: (run.stderr || "").trim(),
    durationMs,
    tests: [],
    sandboxed: true,
    error: run.error?.message,
  };
}

function checkBinaryExists(binary: string): boolean {
  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    const check = spawnSync(cmd, [binary], {
      windowsHide: true,
      timeout: 2000,
      encoding: "utf8",
    });
    return check.status === 0;
  } catch {
    return false;
  }
}
