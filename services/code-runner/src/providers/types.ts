import type {
  CodeValidationRequest,
  CodeValidationResponse,
  LanguageRuntimeProfile,
} from "@ai-copilot/contracts";

export interface ExecutionEnvironmentInfo {
  runtimeName: string;
  runtimeVersion: string;
  kernelVersion: string;
  containerEngine: "podman" | "docker" | "none";
  containerEngineVersion: string | null;
  gvisorVersion: string | null;
  cgroupsV2Supported: boolean;
  networkIsolationEnforced: boolean;
  status: "ready" | "blocked" | "fallback_local";
  blockReason?: string | undefined;
  imageDigests: Record<string, string>;
}

export interface ExecutionProvider {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  getEnvironmentInfo(): Promise<ExecutionEnvironmentInfo>;
  execute(
    request: CodeValidationRequest,
    profile: LanguageRuntimeProfile
  ): Promise<CodeValidationResponse>;
}
