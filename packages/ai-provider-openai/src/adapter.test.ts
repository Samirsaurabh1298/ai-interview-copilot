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

  it("reports GPT-4o and GPT-4o-mini capabilities and pricing", async () => {
    const provider = new OpenAIProvider("test-openai-key");
    const caps = await provider.getCapabilities();
    expect(caps.length).toBe(2);
    
    const mini = caps.find((c) => c.id === "gpt-4o-mini");
    expect(mini).toBeDefined();
    expect(mini?.supportsStructuredOutput).toBe(true);
    expect(mini?.costPerMillionInputTokensUsd).toBe(0.15);
    expect(mini?.costPerMillionOutputTokensUsd).toBe(0.60);
    expect(mini?.isRecommended).toBe(true);

    const gpt4o = caps.find((c) => c.id === "gpt-4o");
    expect(gpt4o).toBeDefined();
    expect(gpt4o?.supportsVision).toBe(true);
    expect(gpt4o?.supportsStructuredOutput).toBe(true);
    expect(gpt4o?.costPerMillionInputTokensUsd).toBe(2.5);
    expect(gpt4o?.costPerMillionOutputTokensUsd).toBe(10.0);
  });
});
