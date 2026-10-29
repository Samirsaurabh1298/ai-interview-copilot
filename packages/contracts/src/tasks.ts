import { z } from "zod";

export const TaskTypeSchema = z.enum([
  "explain",
  "debug",
  "implement",
  "refactor",
  "test",
  "review",
  "mock-interview",
]);

export type TaskType = z.infer<typeof TaskTypeSchema>;

export const QuestionCategorySchema = z.enum([
  "code-comprehension",
  "debugging",
  "implementation",
  "refactoring",
  "testing",
  "javascript",
  "react",
  "system-design",
  "other",
]);

export type QuestionCategory = z.infer<typeof QuestionCategorySchema>;

