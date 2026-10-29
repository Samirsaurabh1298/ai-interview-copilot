import { z } from "zod";

export const UserRecordSchema = z.object({
  id: z.string().uuid(),
  authSubject: z.string(),
  email: z.string().email().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  status: z.enum(["active", "suspended", "pending"]),
});

export type UserRecord = z.infer<typeof UserRecordSchema>;

export const UserPreferencesRecordSchema = z.object({
  userId: z.string().uuid(),
  defaultProvider: z.enum(["anthropic", "google", "openai", "mock"]),
  defaultModel: z.string(),
  responseStyle: z.enum(["concise", "detailed"]),
  historyEnabled: z.boolean(),
  updatedAt: z.date(),
});

export type UserPreferencesRecord = z.infer<typeof UserPreferencesRecordSchema>;

export const UsageEventRecordSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  provider: z.string(),
  model: z.string(),
  operation: z.enum(["generate_answer", "extract_vision", "code_validation"]),
  inputUnits: z.number().int().nonnegative(),
  outputUnits: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  status: z.enum(["success", "failure", "timeout"]),
  createdAt: z.date(),
});

export type UsageEventRecord = z.infer<typeof UsageEventRecordSchema>;

export const SessionRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  taskType: z.string(),
  provider: z.string(),
  createdAt: z.date(),
  expiresAt: z.date().optional(),
});

export type SessionRecord = z.infer<typeof SessionRecordSchema>;

export const SessionMessageRecordSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
});

export type SessionMessageRecord = z.infer<typeof SessionMessageRecordSchema>;
