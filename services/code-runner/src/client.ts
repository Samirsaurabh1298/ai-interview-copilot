import type {
  CodeValidationRequest,
  CodeValidationResponse,
} from "@ai-copilot/contracts";
import { executeCodeInSandbox } from "./runner.js";
import { OciGvisorExecutionProvider } from "./providers/oci-gvisor.js";
import type { ExecutionEnvironmentInfo } from "./providers/types.js";

export interface CodeRunnerClientOptions {
  serviceUrl?: string;
  timeoutMs?: number;
  allowLocalFallback?: boolean;
}

export class CodeRunnerClient {
  private readonly serviceUrl: string;
  private readonly timeoutMs: number;
  private readonly allowLocalFallback: boolean;
  private readonly ociProvider: OciGvisorExecutionProvider;

  constructor(options?: CodeRunnerClientOptions) {
    this.serviceUrl =
      options?.serviceUrl ||
      process.env.CODE_RUNNER_SERVICE_URL ||
      "http://127.0.0.1:4100";
    this.timeoutMs = options?.timeoutMs || 20000;
    this.allowLocalFallback = options?.allowLocalFallback ?? true;
    this.ociProvider = new OciGvisorExecutionProvider();
  }

  public async getHealth(): Promise<{ status: string; service: string }> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.serviceUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        return (await res.json()) as { status: string; service: string };
      }
    } catch {}
    return { status: "unreachable", service: "code-runner" };
  }

  public async getEnvironmentInfo(): Promise<ExecutionEnvironmentInfo> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${this.serviceUrl}/environment`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        return (await res.json()) as ExecutionEnvironmentInfo;
      }
    } catch {}

    // Fall back to local provider inspection
    return this.ociProvider.getEnvironmentInfo();
  }

  public async execute(
    request: CodeValidationRequest
  ): Promise<CodeValidationResponse> {
    // 1. Attempt dispatch to dedicated standalone runner daemon
    try {
      const controller = new AbortController();
      const timeout = (request.timeoutMs || 5000) + 5000;
      const timer = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(`${this.serviceUrl}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        return (await res.json()) as CodeValidationResponse;
      }
    } catch (err) {
      if (!this.allowLocalFallback) {
        throw new Error(
          `Dedicated Code Runner Daemon unreachable at ${this.serviceUrl}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // 2. Fallback to hardened local execution if permitted
    return executeCodeInSandbox(request);
  }
}

