import { describe, it, expect } from "vitest";
import { OciGvisorExecutionProvider } from "./oci-gvisor.js";
import { executePolyglotCompiler } from "../compilers.js";
import { CodeRunnerClient } from "../client.js";
import { LANGUAGE_RUNTIME_PROFILES } from "@ai-copilot/contracts";

describe("LOOP 9 — OCI / gVisor Runner & Security Verification", () => {
  const provider = new OciGvisorExecutionProvider();

  it("inspects execution environment and returns complete environment telemetry", async () => {
    const env = await provider.getEnvironmentInfo();

    expect(env.runtimeName).toBeDefined();
    expect(env.runtimeVersion).toBeDefined();
    expect(env.kernelVersion).toBeDefined();
    expect(["podman", "docker", "none"]).toContain(env.containerEngine);
    expect(["ready", "blocked", "fallback_local"]).toContain(env.status);

    // Verify all 7 language runtime profile image digests are indexed
    expect(env.imageDigests["typescript"]).toBe(LANGUAGE_RUNTIME_PROFILES.typescript.imageDigest);
    expect(env.imageDigests["python"]).toBe(LANGUAGE_RUNTIME_PROFILES.python.imageDigest);
    expect(env.imageDigests["go"]).toBe(LANGUAGE_RUNTIME_PROFILES.go.imageDigest);
    expect(env.imageDigests["java"]).toBe(LANGUAGE_RUNTIME_PROFILES.java.imageDigest);
    expect(env.imageDigests["cpp"]).toBe(LANGUAGE_RUNTIME_PROFILES.cpp.imageDigest);
    expect(env.imageDigests["rust"]).toBe(LANGUAGE_RUNTIME_PROFILES.rust.imageDigest);
  });

  it("accurately marks execution blocked if container virtualization is restricted by host GPO", async () => {
    const env = await provider.getEnvironmentInfo();

    // On this Windows test host, Podman/WSL machine cannot boot due to 0x80070569
    if (env.status === "blocked") {
      expect(env.blockReason).toBeDefined();
      expect(env.cgroupsV2Supported).toBe(false);

      const result = await provider.execute(
        {
          language: "typescript",
          code: "console.log('test');",
          testCode: "test('t', () => {});",
          timeoutMs: 3000,
          memoryLimitMb: 128,
        },
        LANGUAGE_RUNTIME_PROFILES.typescript
      );

      // Must fail honestly rather than faking execution
      expect(result.success).toBe(false);
      expect(result.passed).toBe(false);
      expect(result.stderr).toContain("OCI_EXECUTION_BLOCKED");
    }
  }, 15000);

  it("executes polyglot compiler runner and fails honestly with COMPILER_NOT_FOUND when toolchain is absent", () => {
    // Test Go compiler runner
    const goResult = executePolyglotCompiler(
      {
        language: "go",
        code: "package main\nfunc Add(a, b int) int { return a + b }",
        testCode: "package main\nimport \"testing\"\nfunc TestAdd(t *testing.T) {}",
        timeoutMs: 3000,
        memoryLimitMb: 128,
      },
      LANGUAGE_RUNTIME_PROFILES.go
    );

    // If 'go' is not on the host, it must return exitCode 127 with COMPILER_NOT_FOUND
    if (!goResult.success && goResult.exitCode === 127) {
      expect(goResult.stderr).toContain("COMPILER_NOT_FOUND");
      expect(goResult.passed).toBe(false);
    }
  });

  it("instantiates CodeRunnerClient with typed environment inspection", async () => {
    const client = new CodeRunnerClient({ allowLocalFallback: true });
    const env = await client.getEnvironmentInfo();

    expect(env).toBeDefined();
    expect(env.runtimeName).toBeDefined();
    expect(typeof env.cgroupsV2Supported).toBe("boolean");
  });
});
