import { z } from "zod";

export const ProgrammingLanguageSchema = z.enum([
  "typescript",
  "javascript",
  "python",
  "go",
  "java",
  "cpp",
  "rust",
]);
export type ProgrammingLanguage = z.infer<typeof ProgrammingLanguageSchema>;

export const CodeValidationRequestSchema = z
  .object({
    language: ProgrammingLanguageSchema,
    code: z.string().optional().default(""),
    files: z.record(z.string(), z.string()).optional(),
    entryTestFile: z.string().optional(),
    testCode: z.string().min(1, "Test code cannot be empty"),
    timeoutMs: z.number().int().min(500).max(15000).default(5000),
    memoryLimitMb: z.number().int().min(32).max(512).default(128),
  })
  .refine(
    (req) =>
      req.code.trim().length > 0 ||
      (req.files !== undefined && Object.keys(req.files).length > 0),
    {
      message: "Either code or a non-empty files map must be provided",
      path: ["code"],
    }
  );

export type CodeValidationRequest = z.infer<typeof CodeValidationRequestSchema>;

export const SingleTestResultSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  durationMs: z.number().nonnegative(),
  error: z.string().optional(),
});

export type SingleTestResult = z.infer<typeof SingleTestResultSchema>;

export const CodeValidationResponseSchema = z.object({
  success: z.boolean(),
  passed: z.boolean(),
  exitCode: z.number().int(),
  stdout: z.string(),
  stderr: z.string(),
  durationMs: z.number().nonnegative(),
  tests: z.array(SingleTestResultSchema).default([]),
  sandboxed: z.literal(true),
  error: z.string().optional(),
});

export type CodeValidationResponse = z.infer<typeof CodeValidationResponseSchema>;

