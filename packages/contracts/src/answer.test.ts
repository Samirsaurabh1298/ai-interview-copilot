import { describe, it, expect } from "vitest";
import { InterviewAnswerSchema } from "./answer.js";
import { AIRequestSchema } from "./request.js";

describe("Contracts Schema Validation", () => {
  it("successfully parses a valid InterviewAnswer object", () => {
    const rawAnswer = {
      question: "Reverse a linked list in-place",
      category: "debugging",
      assumptions: ["Input list is singly-linked"],
      diagnosis: ["Pointer reassignment had off-by-one error"],
      approach: ["Maintain prev, curr, next pointers"],
      codeChanges: [
        {
          path: "solution.ts",
          description: "Update next pointer swap loop",
          diff: "- curr.next = null;\n+ curr.next = prev;",
        },
      ],
      code: "function reverseList(head) { ... }",
      timeComplexity: "O(n)",
      spaceComplexity: "O(1)",
      tests: [
        {
          name: "Empty list",
          purpose: "Verify null input returns null",
          expectedResult: "null",
        },
      ],
      edgeCases: ["Single node", "Cyclic list"],
      explanation: "Reversing iteratively ensures O(1) auxiliary memory.",
      followUpQuestions: ["Can you do this recursively?"],
      confidence: 0.95,
      limitations: ["Does not detect cycles"],
    };

    const parsed = InterviewAnswerSchema.safeParse(rawAnswer);
    expect(parsed.success).toBe(true);
  });

  it("fails to parse when required fields are missing", () => {
    const invalidAnswer = {
      category: "debugging",
      explanation: "Missing question property",
    };

    const parsed = InterviewAnswerSchema.safeParse(invalidAnswer);
    expect(parsed.success).toBe(false);
  });

  it("applies sensible defaults for optional arrays", () => {
    const minimalAnswer = {
      question: "Explain useMemo vs useCallback",
      category: "react",
      explanation: "useMemo caches a computed value; useCallback caches a function instance.",
    };

    const parsed = InterviewAnswerSchema.parse(minimalAnswer);
    expect(parsed.assumptions).toEqual([]);
    expect(parsed.diagnosis).toEqual([]);
    expect(parsed.codeChanges).toEqual([]);
    expect(parsed.tests).toEqual([]);
    expect(parsed.edgeCases).toEqual([]);
    expect(parsed.followUpQuestions).toEqual([]);
  });

  it("validates AIRequest with defaults", () => {
    const request = {
      task: "debug",
      question: "Why does useEffect run twice in React 18?",
    };

    const parsed = AIRequestSchema.parse(request);
    expect(parsed.responseStyle).toBe("concise");
    expect(parsed.context).toEqual([]);
  });
});

