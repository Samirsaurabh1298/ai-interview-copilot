import { describe, it, expect } from "vitest";
import { GoogleGeminiProvider } from "./adapter.js";
import { AIProviderError } from "@ai-copilot/ai-core";

describe("GoogleGeminiProvider Adapter", () => {
  it("throws AUTHENTICATION_FAILED if API key is missing", () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    expect(() => new GoogleGeminiProvider()).toThrow(AIProviderError);
  });

  it("instantiates cleanly with key", () => {
    const provider = new GoogleGeminiProvider("test-google-key");
    expect(provider.id).toBe("google");
    expect(provider.name).toContain("Gemini 2.0 Flash");
  });

  it("reports 1M token context window and pricing", async () => {
    const provider = new GoogleGeminiProvider("test-google-key");
    const caps = await provider.getCapabilities();
    expect(caps.length).toBe(1);
    expect(caps[0]?.contextWindow).toBe(1048576);
    expect(caps[0]?.supportsVision).toBe(true);
    expect(caps[0]?.costPerMillionInputTokensUsd).toBe(0.1);
  });
});
