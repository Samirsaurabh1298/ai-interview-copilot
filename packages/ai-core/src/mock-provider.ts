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

    if (request.policyMode === "flawed_junior") {
      return {
        question: request.question,
        category: isDebug ? "debugging" : "implementation",
        assumptions: ["Input array can probably be mutated directly for performance"],
        diagnosis: [
          "Maybe just sort the array in place using `.sort()` without checking secondary fields",
        ],
        approach: [
          "1. Call `items.sort(...)` directly to keep memory zero",
          "2. Skip undefined guards assuming callers always pass valid arrays",
        ],
        codeChanges: [
          {
            path: "solution.ts",
            description: "Quick in-place sort (Warning: may miss immutability or tie-breaking)",
          },
        ],
        code: `// Naive suggestion (misses immutability & edge cases)\nexport function quickFix(items: any[]) {\n  return items.sort((a, b) => (b.priority > a.priority ? 1 : -1));\n}`,
        timeComplexity: "O(n log n)",
        spaceComplexity: "O(1)",
        tests: [
          {
            name: "Happy path basic sort",
            purpose: "Checks basic ordering only",
            expectedResult: "sorted array",
          },
        ],
        edgeCases: ["Did not verify immutability or undefined tags"],
        explanation:
          "Sorting the array directly avoids creating a copy. That should probably fix the ordering issue, though tie-breakers and mutations weren't checked.",
        followUpQuestions: ["Does calling `.sort()` directly mutate caller state?"],
        confidence: 0.62,
        limitations: ["Flawed Junior AI Mode: Shallow suggestion; verify edge cases independently."],
        provider: this.id,
        model: modelOverride ?? "mock-flawed-junior-v1",
        usage: {
          inputTokens: 180,
          outputTokens: 210,
          estimatedCostUsd: 0,
        },
      };
    }

    if (request.policyMode === "restricted_explainer") {
      return {
        question: request.question,
        category: isDebug ? "debugging" : "implementation",
        assumptions: ["Code modifications are restricted to candidate authorship"],
        diagnosis: [
          "Look closely at reference mutability and multi-key comparator ordering",
        ],
        approach: [
          "1. Avoid mutating shared references passed by callers",
          "2. Establish deterministic tie-breaking on equal primary keys",
        ],
        codeChanges: [],
        code: "",
        timeComplexity: "O(n log n)",
        spaceComplexity: "O(n)",
        tests: [],
        edgeCases: ["Empty inputs", "Ties in primary sort key"],
        explanation:
          "In JavaScript/TypeScript, `Array.prototype.sort` mutates the receiver in-place. Clone before sorting and chain a deterministic secondary comparison when primary weights match.",
        followUpQuestions: ["How do you copy an array shallowly before sorting?"],
        confidence: 0.9,
        limitations: ["Restricted Explainer Mode: Direct code patches are disabled by policy."],
        provider: this.id,
        model: modelOverride ?? this.defaultModel,
        usage: {
          inputTokens: 200,
          outputTokens: 240,
          estimatedCostUsd: 0,
        },
      };
    }

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

