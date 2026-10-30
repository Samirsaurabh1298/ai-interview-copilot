import type {
  AIRequest,
  AIResponse,
  ProvidersResponse,
  QuestionExtractionResponse,
  CodeValidationRequest,
  CodeValidationResponse,
  ToolPolicy,
  SessionBudgetStatus,
  CandidateSubmission,
  AssessmentScorecard,
} from "@ai-copilot/contracts";

const API_BASE_URL = "http://localhost:4000/api/v1";

export class ApiClient {
  public static async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch("http://localhost:4000/health");
      return res.ok;
    } catch {
      return false;
    }
  }

  public static async getProviders(): Promise<ProvidersResponse> {
    const res = await fetch(`${API_BASE_URL}/providers`);
    if (!res.ok) {
      throw new Error(`Failed to fetch providers: ${res.statusText}`);
    }
    return (await res.json()) as ProvidersResponse;
  }

  public static async extractQuestion(
    imageBase64: string,
    userHint?: string
  ): Promise<QuestionExtractionResponse> {
    const res = await fetch(`${API_BASE_URL}/questions/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64,
        userHint,
      }),
    });
    if (!res.ok) {
      throw new Error(`Extraction failed: ${res.statusText}`);
    }
    return (await res.json()) as QuestionExtractionResponse;
  }

  public static async generateAnswer(
    request: AIRequest,
    providerId?: string,
    sessionId?: string
  ): Promise<AIResponse> {
    const params = new URLSearchParams();
    if (providerId) params.append("provider", providerId);
    if (sessionId) params.append("sessionId", sessionId);

    const queryString = params.toString() ? `?${params.toString()}` : "";
    const url = `${API_BASE_URL}/answers/generate${queryString}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const errorData = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      throw new Error(
        errorData.message || errorData.error || `Generation failed: ${res.statusText}`
      );
    }

    return (await res.json()) as AIResponse;
  }

  public static async validateCode(
    request: CodeValidationRequest
  ): Promise<CodeValidationResponse> {
    const res = await fetch(`${API_BASE_URL}/code/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const errorData = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      throw new Error(
        errorData.message || errorData.error || `Validation failed: ${res.statusText}`
      );
    }

    return (await res.json()) as CodeValidationResponse;
  }

  public static async getAssessmentPolicy(sessionId?: string): Promise<ToolPolicy> {
    const url = sessionId
      ? `${API_BASE_URL}/assessment/policy?sessionId=${sessionId}`
      : `${API_BASE_URL}/assessment/policy`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch policy: ${res.statusText}`);
    }
    return (await res.json()) as ToolPolicy;
  }

  public static async getBudgetStatus(sessionId: string): Promise<SessionBudgetStatus> {
    const res = await fetch(`${API_BASE_URL}/assessment/budget/${sessionId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch budget status: ${res.statusText}`);
    }
    return (await res.json()) as SessionBudgetStatus;
  }

  public static async evaluateAssessment(
    submission: CandidateSubmission
  ): Promise<AssessmentScorecard> {
    const res = await fetch(`${API_BASE_URL}/assessment/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
    });

    if (!res.ok) {
      const errorData = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      throw new Error(
        errorData.message || errorData.error || `Evaluation failed: ${res.statusText}`
      );
    }

    return (await res.json()) as AssessmentScorecard;
  }
}


