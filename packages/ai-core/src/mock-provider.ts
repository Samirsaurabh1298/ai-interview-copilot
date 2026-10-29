import type { AIRequest, AIResponse, ModelCapability } from "@ai-copilot/contracts";
import type { AIProvider } from "./types.js";

export class MockAIProvider implements AIProvider {
  public readonly id = "mock" as const;
  public readonly name = "Mock Deterministic Provider";
  public readonly defaultModel = "mock-model-v1";

  private failureMode: "none" | "rate_limit" | "invalid_schema" | "timeout" = "none";

  public setFailureMode(mode: "none" | "rate_limit" | "invalid_schema" | "timeout"): void {
    this.failureMode = mode;
  }

  public async getCapabilities(): Promise<ModelCapability[]> {
    return [
      {
        id: "mock-model-v1",
        name: "Mock Model v1",
        provider: "openai",
        supportsVision: true,
        supportsStreaming: true,
        supportsStructuredOutput: true,
        contextWindow: 128000,
        costPerMillionInputTokensUsd: 0,
        costPerMillionOutputTokensUsd: 0,
        isRecommended: true,
      },
    ];
  }

  public async generate(request: AIRequest, modelOverride?: string): Promise<AIResponse> {
    if (this.failureMode === "rate_limit") {
      throw new Error("429 Too Many Requests: Rate limit exceeded");
    }

    if (this.failureMode === "timeout") {
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    const isDebug = request.task === "debug";

    return {
      question: request.question,
      category: isDebug ? "debugging" : "implementation",
      assumptions: [
        "Single-threaded runtime execution",
        "Valid input encoding without memory corruption",
      ],
      diagnosis: isDebug
        ? [
            "Off-by-one boundary index in traversal loop",
            "Missing null-check for undefined edge cases",
          ]
        : ["Clean implementation required following idiomatic guidelines"],
      approach: [
        "1. Guard boundary conditions at function entry",
        "2. Apply minimal atomic fix to address the root cause",
        "3. Verify through unit tests",
      ],
      codeChanges: [
        {
          path: "solution.ts",
          description: "Guard empty state and fix loop termination check",
          diff: "@@ -1,4 +1,4 @@\n- for (let i = 0; i <= arr.length; i++) {\n+ for (let i = 0; i < arr.length; i++) {",
        },
      ],
      code: request.code ?? "function solution() {\n  return true;\n}",
      timeComplexity: "O(n)",
      spaceComplexity: "O(1)",
      tests: [
        {
          name: "Boundary test: empty input",
          purpose: "Ensures empty collections return default state safely",
          expectedResult: "true",
        },
        {
          name: "Standard test: normal array",
          purpose: "Verifies correct calculation on non-empty dataset",
          expectedResult: "expected_output",
        },
      ],
      edgeCases: [
        "Array length = 0",
        "Negative index inputs",
        "Extreme numerical values exceeding safe integer limits",
      ],
      explanation:
        "The bug stemmed from an inclusive loop condition `<=` causing an undefined property access on the final index. Changing to `<` cleanly prevents index-out-of-bounds without altering runtime complexity.",
      followUpQuestions: [
        "How would memory pressure change if the input array had 10^7 items?",
        "Can this operation be parallelized across worker threads?",
      ],
      confidence: 0.95,
      limitations: [
        "Assumes synchronous processing; does not handle async stream backpressure",
      ],
      provider: this.id,
      model: modelOverride ?? this.defaultModel,
      usage: {
        inputTokens: 250,
        outputTokens: 420,
        estimatedCostUsd: 0,
      },
    };
  }
}

