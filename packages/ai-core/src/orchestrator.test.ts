import { describe, it, expect, beforeEach } from "vitest";
import { AIOrchestrationService } from "./orchestrator.js";
import { MockAIProvider } from "./mock-provider.js";
import { AIProviderError } from "./errors.js";

describe("AIOrchestrationService", () => {
  let orchestrator: AIOrchestrationService;
  let mockProvider: MockAIProvider;

  beforeEach(() => {
    orchestrator = new AIOrchestrationService({
      defaultProviderId: "mock",
      maxRetries: 1,
      timeoutMs: 1000,
    });
    mockProvider = new MockAIProvider();
    orchestrator.registerProvider(mockProvider);
  });

  it("successfully orchestrates and returns schema-valid response", async () => {
    const response = await orchestrator.generateAnswer({
      task: "debug",
      question: "Index out of range error in binary search loop",
      code: "while (low <= high) { ... }",
    });

    expect(response.category).toBe("debugging");
    expect(response.diagnosis.length).toBeGreaterThan(0);
    expect(response.approach.length).toBeGreaterThan(0);
    expect(response.tests.length).toBeGreaterThan(0);
    expect(response.confidence).toBe(0.95);
  });

  it("rejects invalid raw requests with strict schema error", async () => {
    await expect(
      orchestrator.generateAnswer({
        task: "invalid-task-type",
      })
    ).rejects.toThrow(AIProviderError);
  });

  it("handles provider timeout gracefully", async () => {
    const fastTimeoutOrchestrator = new AIOrchestrationService({
      defaultProviderId: "mock",
      maxRetries: 0,
      timeoutMs: 50,
    });
    mockProvider.setFailureMode("timeout");
    fastTimeoutOrchestrator.registerProvider(mockProvider);

    await expect(
      fastTimeoutOrchestrator.generateAnswer({
        task: "explain",
        question: "Explain event loop",
      })
    ).rejects.toThrow(/timed out/i);
  });

  it("throws when unregistered provider is requested", async () => {
    await expect(
      orchestrator.generateAnswer(
        {
          task: "explain",
          question: "Explain closures",
        },
        { providerId: "non-existent-provider" }
      )
    ).rejects.toThrow(/not registered/i);
  });
});

