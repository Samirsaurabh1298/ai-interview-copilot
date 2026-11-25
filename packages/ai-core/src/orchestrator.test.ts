import { describe, it, expect, beforeEach } from "vitest";
import { AIOrchestrationService } from "./orchestrator.js";
import { MockAIProvider } from "./mock-provider.js";
import { AIProviderError } from "./errors.js";
import {
  getSystemPromptForRequest,
  SYSTEM_FLAWED_JUNIOR_PROMPT,
  SYSTEM_RESTRICTED_EXPLAINER_PROMPT,
  SYSTEM_INTERVIEW_COPILOT_PROMPT,
} from "./prompts.js";

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

  it("routes system prompts cleanly for full_copilot, flawed_junior, and restricted_explainer policies", async () => {
    expect(getSystemPromptForRequest()).toBe(SYSTEM_INTERVIEW_COPILOT_PROMPT);
    expect(getSystemPromptForRequest({ policyMode: "full_copilot" })).toBe(SYSTEM_INTERVIEW_COPILOT_PROMPT);
    expect(getSystemPromptForRequest({ policyMode: "flawed_junior" })).toBe(SYSTEM_FLAWED_JUNIOR_PROMPT);
    expect(getSystemPromptForRequest({ policyMode: "restricted_explainer" })).toBe(SYSTEM_RESTRICTED_EXPLAINER_PROMPT);

    const flawedResp = await orchestrator.generateAnswer({
      task: "debug",
      question: "Fix ticket sorting immutability bug",
      policyMode: "flawed_junior",
    });
    expect(flawedResp.confidence).toBeLessThan(0.75);
    expect(flawedResp.model).toBe("mock-flawed-junior-v1");
    expect(flawedResp.limitations.join(" ")).toContain("Flawed Junior AI Mode");

    const explainerResp = await orchestrator.generateAnswer({
      task: "debug",
      question: "How should I avoid mutating arrays?",
      policyMode: "restricted_explainer",
    });
    expect(explainerResp.code).toBe("");
    expect(explainerResp.codeChanges).toEqual([]);
  });
});

