import { spawnSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type {
  CodeValidationRequest,
  CodeValidationResponse,
  LanguageRuntimeProfile,
} from "@ai-copilot/contracts";
import { LANGUAGE_RUNTIME_PROFILES } from "@ai-copilot/contracts";
import type { ExecutionProvider, ExecutionEnvironmentInfo } from "./types.js";

export class OciGvisorExecutionProvider implements ExecutionProvider {
  public readonly name = "oci-gvisor";
  private cachedEnvInfo: ExecutionEnvironmentInfo | null = null;

  public async isAvailable(): Promise<boolean> {
    const env = await this.getEnvironmentInfo();
    return env.status === "ready";
  }

  public async getEnvironmentInfo(forceRefresh: boolean = false): Promise<ExecutionEnvironmentInfo> {
    if (this.cachedEnvInfo && !forceRefresh) {
      return this.cachedEnvInfo;
    }

    const kernelVersion = os.release();
    const runtimeName = os.type();
    const runtimeVersion = os.version ? os.version() : os.release();

    const imageDigests: Record<string, string> = {};
    for (const [lang, profile] of Object.entries(LANGUAGE_RUNTIME_PROFILES)) {
      imageDigests[lang] = profile.imageDigest;
    }

    // 1. Probe for container engines: Podman or Docker
    let containerEngine: "podman" | "docker" | "none" = "none";
    let containerEngineVersion: string | null = null;
    let gvisorVersion: string | null = null;

    // Check Podman
    try {
      const podmanCheck = spawnSync("podman", ["--version"], {
        encoding: "utf8",
        timeout: 3000,
        windowsHide: true,
      });
      if (podmanCheck.status === 0 && podmanCheck.stdout) {
        containerEngine = "podman";
        containerEngineVersion = podmanCheck.stdout.trim();
      }
    } catch {}

    // Check Docker if podman not found
    if (containerEngine === "none") {
      try {
        const dockerCheck = spawnSync("docker", ["--version"], {
          encoding: "utf8",
          timeout: 3000,
          windowsHide: true,
        });
        if (dockerCheck.status === 0 && dockerCheck.stdout) {
          containerEngine = "docker";
          containerEngineVersion = dockerCheck.stdout.trim();
        }
      } catch {}
    }

    // If no engine installed
    if (containerEngine === "none") {
      const result: ExecutionEnvironmentInfo = {
        runtimeName,
        runtimeVersion,
        kernelVersion,
        containerEngine: "none",
        containerEngineVersion: null,
        gvisorVersion: null,
        cgroupsV2Supported: false,
        networkIsolationEnforced: false,
        status: "blocked",
        blockReason:
          "Neither Podman nor Docker is installed or accessible in the execution environment.",
        imageDigests,
      };
      this.cachedEnvInfo = result;
      return result;
    }

    // Check for gVisor (runsc)
    try {
      const runscCheck = spawnSync("runsc", ["--version"], {
        encoding: "utf8",
        timeout: 3000,
        windowsHide: true,
      });
      if (runscCheck.status === 0 && runscCheck.stdout) {
        gvisorVersion = runscCheck.stdout.split("\n")[0] || runscCheck.stdout.trim();
      }
    } catch {}

    // Test whether container engine is currently running and able to spawn containers
    try {
      const probeRun = spawnSync(
        containerEngine,
        ["info", "--format", "{{.Host.CgroupVersion}}"],
        {
          encoding: "utf8",
          timeout: 4000,
          windowsHide: true,
        }
      );

      if (probeRun.status !== 0) {
        // Known failure mode on Windows host with restricted virtualization GPO (Error 0x80070569)
        const errorMsg = probeRun.stderr || probeRun.error?.message || "Container engine daemon is stopped.";
        const result: ExecutionEnvironmentInfo = {
          runtimeName,
          runtimeVersion,
          kernelVersion,
          containerEngine,
          containerEngineVersion,
          gvisorVersion,
          cgroupsV2Supported: false,
          networkIsolationEnforced: false,
          status: "blocked",
          blockReason: `Container daemon unreachable or virtualization denied: ${errorMsg.trim()}`,
          imageDigests,
        };
        this.cachedEnvInfo = result;
        return result;
      }

      const cgroupVer = probeRun.stdout.trim();
      const cgroupsV2Supported = cgroupVer === "2" || cgroupVer.includes("v2");

      const result: ExecutionEnvironmentInfo = {
        runtimeName,
        runtimeVersion,
        kernelVersion,
        containerEngine,
        containerEngineVersion,
        gvisorVersion,
        cgroupsV2Supported,
        networkIsolationEnforced: true,
        status: gvisorVersion ? "ready" : "fallback_local",
        blockReason: gvisorVersion
          ? undefined
          : "gVisor (runsc) OCI runtime is not configured; running under standard container isolation.",
        imageDigests,
      };
      this.cachedEnvInfo = result;
      return result;
    } catch (err) {
      const result: ExecutionEnvironmentInfo = {
        runtimeName,
        runtimeVersion,
        kernelVersion,
        containerEngine,
        containerEngineVersion,
        gvisorVersion: null,
        cgroupsV2Supported: false,
        networkIsolationEnforced: false,
        status: "blocked",
        blockReason: `Failed to probe container runtime: ${err instanceof Error ? err.message : String(err)}`,
        imageDigests,
      };
      this.cachedEnvInfo = result;
      return result;
    }
  }

  public async execute(
    request: CodeValidationRequest,
    profile: LanguageRuntimeProfile
  ): Promise<CodeValidationResponse> {
    const env = await this.getEnvironmentInfo();
    if (env.status === "blocked") {
      return {
        success: false,
        passed: false,
        exitCode: 1,
        stdout: "",
        stderr: `OCI_EXECUTION_BLOCKED: ${env.blockReason}`,
        durationMs: 0,
        tests: [],
        sandboxed: true,
        error: env.blockReason,
      };
    }

    const startTime = Date.now();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-copilot-oci-"));

    try {
      // Write solution and test harness files into ephemeral scratch directory
      const solutionFile = path.join(tmpDir, "solution_code.txt");
      fs.writeFileSync(solutionFile, request.code, "utf8");

      const testFile = path.join(tmpDir, "test_code.txt");
      fs.writeFileSync(testFile, request.testCode, "utf8");

      // Construct hardened OCI run arguments
      const args: string[] = [
        "run",
        "--rm",
        "--network=none", // Strict dropped network namespace
        `--memory=${profile.memoryLimitMb}m`,
        `--cpus=${profile.cpuQuota}`,
        `--pids-limit=${profile.pidLimit}`,
        "--read-only", // Read-only root filesystem
        "--tmpfs=/tmp:rw,noexec,nosuid,size=32m",
        "--user=1000:1000", // Non-root execution
        "-v",
        `${tmpDir}:/workspace:rw`,
        "-w",
        "/workspace",
      ];

      if (env.gvisorVersion) {
        args.splice(1, 0, "--runtime=runsc");
      }

      args.push(profile.imageDigest);

      // Execute container with strict execution timeout
      const child = spawnSync(env.containerEngine, args, {
        encoding: "utf8",
        timeout: profile.executionTimeoutMs + profile.compilationTimeoutMs,
        windowsHide: true,
      });

      const durationMs = Date.now() - startTime;
      const stdout = child.stdout || "";
      const stderr = child.stderr || "";

      return {
        success: child.status === 0,
        passed: child.status === 0,
        exitCode: child.status ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        durationMs,
        tests: [],
        sandboxed: true,
        error: child.error?.message,
      };
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  }
}
