import { z } from "zod";
import { QuestionCategorySchema } from "./tasks.js";

export const CodeChangeSchema = z.object({
  path: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  diff: z.string().optional(),
});

export type CodeChange = z.infer<typeof CodeChangeSchema>;

export const TestCaseSchema = z.object({
  name: z.string().min(1, "Test name is required"),
  purpose: z.string().min(1, "Test purpose is required"),
  expectedResult: z.string().optional(),
});

export type TestCase = z.infer<typeof TestCaseSchema>;

export const InterviewAnswerSchema = z.object({
  question: z.string().min(1, "Question cannot be empty"),
  category: QuestionCategorySchema,
  assumptions: z.array(z.string()).default([]),
  diagnosis: z.array(z.string()).default([]),
  approach: z.array(z.string()).default([]),
  codeChanges: z.array(CodeChangeSchema).default([]),
  code: z.string().optional(),
  timeComplexity: z.string().optional(),
  spaceComplexity: z.string().optional(),
  tests: z.array(TestCaseSchema).default([]),
  edgeCases: z.array(z.string()).default([]),
  explanation: z.string().min(1, "Explanation is required"),
  followUpQuestions: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).optional(),
  limitations: z.array(z.string()).default([]),
});

export type InterviewAnswer = z.infer<typeof InterviewAnswerSchema>;

