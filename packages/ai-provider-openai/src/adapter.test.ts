import { describe, it, expect } from "vitest";
import { OpenAIProvider } from "./adapter.js";
import { AIProviderError } from "@ai-copilot/ai-core";

describe("OpenAIProvider Adapter", () => {
  it("throws AUTHENTICATION_FAILED if API key is missing", () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => new OpenAIProvider()).toThrow(AIProviderError);
  });

  it("instantiates cleanly with key", () => {
    const provider = new OpenAIProvider("test-openai-key");
    expect(provider.id).toBe("openai");
    expect(provider.name).toContain("GPT-4o");
  });

  it("reports GPT-4o capabilities and pricing", async () => {
    const provider = new OpenAIProvider("test-openai-key");
    const caps = await provider.getCapabilities();
    expect(caps.length).toBe(1);
    expect(caps[0]?.supportsVision).toBe(true);
    expect(caps[0]?.supportsStructuredOutput).toBe(true);
    expect(caps[0]?.costPerMillionInputTokensUsd).toBe(2.5);
    expect(caps[0]?.costPerMillionOutputTokensUsd).toBe(10.0);
  });
});
