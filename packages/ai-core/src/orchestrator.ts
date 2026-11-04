import {
  AIRequestSchema,
  AIResponseSchema,
  type AIRequest,
  type AIResponse,
} from "@ai-copilot/contracts";
import type { AIProvider, OrchestratorOptions } from "./types.js";
import { AIProviderError } from "./errors.js";

export class AIOrchestrationService {
  private providers = new Map<string, AIProvider>();
  private defaultProviderId: string;
  private maxRetries: number;
  private timeoutMs: number;

  constructor(options: OrchestratorOptions = {}) {
    this.defaultProviderId = options.defaultProviderId ?? "mock";
    this.maxRetries = options.maxRetries ?? 2;
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  public registerProvider(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProvider(id?: string): AIProvider {
    const targetId = id ?? this.defaultProviderId;
    const provider = this.providers.get(targetId);
    if (!provider) {
      throw new AIProviderError({
        message: `Provider '${targetId}' is not registered or configured.`,
        code: "PROVIDER_UNAVAILABLE",
        provider: targetId,
        isRetryable: false,
      });
    }
    return provider;
  }

  public async generateAnswer(
    rawRequest: unknown,
    options?: { providerId?: string | undefined; modelOverride?: string | undefined }
  ): Promise<AIResponse> {
    // 1. Strict runtime schema validation of incoming request
    const parseResult = AIRequestSchema.safeParse(rawRequest);
    if (!parseResult.success) {
      throw new AIProviderError({
        message: `Invalid AIRequest: ${parseResult.error.message}`,
        code: "INVALID_RESPONSE_SCHEMA",
        provider: options?.providerId ?? this.defaultProviderId,
        isRetryable: false,
      });
    }

    const request: AIRequest = parseResult.data;
    const provider = this.getProvider(options?.providerId);

    // 2. Execution with timeout and retry logic
    let attempts = 0;
    let lastError: unknown;

    while (attempts <= this.maxRetries) {
      try {
        const responsePromise = provider.generate(request, options?.modelOverride);
        const rawResponse = await this.withTimeout(responsePromise, this.timeoutMs);

        // 3. Strict schema validation of AI output
        const validation = AIResponseSchema.safeParse(rawResponse);
        if (!validation.success) {
          throw new AIProviderError({
            message: `AI provider returned invalid schema response: ${validation.error.message}`,
            code: "INVALID_RESPONSE_SCHEMA",
            provider: provider.id,
            isRetryable: true,
          });
        }

        return validation.data;
      } catch (err: unknown) {
        attempts++;
        lastError = err;

        const isRetryable =
          err instanceof AIProviderError
            ? err.isRetryable
            : this.isTransientNetworkError(err);

        if (!isRetryable || attempts > this.maxRetries) {
          break;
        }

        // Exponential backoff with jitter: delay = 2^attempt * 250ms + jitter
        const jitter = Math.floor(Math.random() * 200);
        const backoffMs = Math.pow(2, attempts) * 250 + jitter;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    // Graceful fallback to mock provider if primary external provider fails (network error, outage, or timeout)
    if (provider.id !== "mock" && this.providers.has("mock")) {
      try {
        const fallbackProvider = this.providers.get("mock")!;
        const fallbackRes = await fallbackProvider.generate(request);
        const parsed = AIResponseSchema.safeParse(fallbackRes);
        if (parsed.success) {
          const reason = lastError instanceof Error ? lastError.message : "Connection error";
          return {
            ...parsed.data,
            explanation: `[Advisory: Primary provider '${provider.id}' was unavailable (${reason}). Responded via deterministic assessment assistant.]\n\n${parsed.data.explanation}`,
          };
        }
      } catch {
        // Ignore fallback failure and throw original error below
      }
    }

    if (lastError instanceof AIProviderError) {
      throw lastError;
    }

    throw new AIProviderError({
      message:
        lastError instanceof Error ? lastError.message : "Unknown error during AI generation",
      code: "PROVIDER_UNAVAILABLE",
      provider: provider.id,
      isRetryable: false,
      cause: lastError,
    });
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new AIProviderError({
            message: `AI request timed out after ${ms}ms`,
            code: "TIMEOUT",
            provider: this.defaultProviderId,
            isRetryable: true,
          })
        );
      }, ms);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private isTransientNetworkError(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const msg = (err as { message?: string }).message?.toLowerCase() ?? "";
    return (
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("429") ||
      msg.includes("rate limit") ||
      msg.includes("fetch failed")
    );
  }
}

