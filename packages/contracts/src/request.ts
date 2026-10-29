import { z } from "zod";
import { TaskTypeSchema } from "./tasks.js";
import { InterviewAnswerSchema } from "./answer.js";

export const ContextSourceSchema = z.enum(["user", "screenshot", "repository"]);
export type ContextSource = z.infer<typeof ContextSourceSchema>;

export const ContextItemSchema = z.object({
  path: z.string().optional(),
  content: z.string().min(1, "Context content cannot be empty"),
  source: ContextSourceSchema,
});

export type ContextItem = z.infer<typeof ContextItemSchema>;

export const ResponseStyleSchema = z.enum(["concise", "detailed"]);
export type ResponseStyle = z.infer<typeof ResponseStyleSchema>;

export const AIRequestSchema = z.object({
  task: TaskTypeSchema,
  question: z.string().min(1, "Question cannot be empty"),
  language: z.string().optional(),
  code: z.string().optional(),
  context: z.array(ContextItemSchema).optional().default([]),
  responseStyle: ResponseStyleSchema.optional().default("concise"),
});

export type AIRequest = z.infer<typeof AIRequestSchema>;

export const AIResponseSchema = InterviewAnswerSchema.extend({
  provider: z.string(),
  model: z.string(),
  usage: z
    .object({
      inputTokens: z.number().int().nonnegative().optional(),
      outputTokens: z.number().int().nonnegative().optional(),
      estimatedCostUsd: z.number().nonnegative().optional(),
    })
    .optional(),
});

export type AIResponse = z.infer<typeof AIResponseSchema>;

