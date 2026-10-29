import type {
  AIRequest,
  AIResponse,
  ProvidersResponse,
  QuestionExtractionResponse,
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

  public static async generateAnswer(request: AIRequest): Promise<AIResponse> {
    const res = await fetch(`${API_BASE_URL}/answers/generate`, {
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
}

