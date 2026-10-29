import { describe, it, expect } from "vitest";
import { AnthropicProvider } from "./adapter.js";
import { AIProviderError } from "@ai-copilot/ai-core";

describe("AnthropicProvider Adapter", () => {
  it("throws AUTHENTICATION_FAILED if API key is missing", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => new AnthropicProvider()).toThrow(AIProviderError);
  });

  it("instantiates cleanly with dummy test key", () => {
    const provider = new AnthropicProvider("test-anthropic-key");
    expect(provider.id).toBe("anthropic");
    expect(provider.name).toContain("Claude 3.5 Sonnet");
  });

  it("reports correct model capabilities and token pricing", async () => {
    const provider = new AnthropicProvider("test-anthropic-key");
    const caps = await provider.getCapabilities();
    expect(caps.length).toBe(1);
    expect(caps[0]?.supportsVision).toBe(true);
    expect(caps[0]?.supportsStructuredOutput).toBe(true);
    expect(caps[0]?.costPerMillionInputTokensUsd).toBe(3.0);
    expect(caps[0]?.costPerMillionOutputTokensUsd).toBe(15.0);
  });
});
