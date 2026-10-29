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
});

