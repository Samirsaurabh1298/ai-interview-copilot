import { describe, it, expect, vi } from "vitest";
import { GroqProvider } from "./adapter.js";
import { AIProviderError } from "@ai-copilot/ai-core";
import type { AIRequest } from "@ai-copilot/contracts";

describe("GroqProvider", () => {
  it("throws AUTHENTICATION_FAILED if no API key is provided", () => {
    delete process.env.GROQ_API_KEY;
    expect(() => new GroqProvider()).toThrow(AIProviderError);
  });

  it("initializes with valid API key and exposes Groq capabilities", async () => {
    const provider = new GroqProvider("gsk_mock_test_key_12345");
    expect(provider.id).toBe("groq");
    expect(provider.name).toContain("Groq");

    const capabilities = await provider.getCapabilities();
    expect(capabilities).toHaveLength(2);
    expect(capabilities[0]?.provider).toBe("groq");
    expect(capabilities[0]?.id).toBe("qwen/qwen3.8-27b");
  });

  it("handles generation error by wrapping into AIProviderError", async () => {
    const provider = new GroqProvider("gsk_mock_test_key_12345");
    const request: AIRequest = {
      task: "debug",
      question: "Off by one error in loop",
      code: "for (let i = 0; i <= arr.length; i++)",
    };

    // Client call with fake key against real API will fail with 401
    await expect(provider.generate(request)).rejects.toThrow(AIProviderError);
  });
});
