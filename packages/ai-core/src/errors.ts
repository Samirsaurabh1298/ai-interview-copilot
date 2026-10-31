export type ProviderErrorCode =
  | "AUTHENTICATION_FAILED"
  | "RATE_LIMIT_EXCEEDED"
  | "QUOTA_EXHAUSTED"
  | "SESSION_EXPIRED"
  | "TIMEOUT"
  | "INVALID_RESPONSE_SCHEMA"
  | "PROVIDER_UNAVAILABLE"
  | "PROMPT_INJECTION_DETECTED"
  | "CONTEXT_LENGTH_EXCEEDED";

export class AIProviderError extends Error {
  public readonly code: ProviderErrorCode;
  public readonly provider: string;
  public readonly isRetryable: boolean;
  public readonly retryAfterMs?: number | undefined;

  constructor(options: {
    message: string;
    code: ProviderErrorCode;
    provider: string;
    isRetryable?: boolean | undefined;
    retryAfterMs?: number | undefined;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = "AIProviderError";
    this.code = options.code;
    this.provider = options.provider;
    this.isRetryable = options.isRetryable ?? false;
    this.retryAfterMs = options.retryAfterMs;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}
