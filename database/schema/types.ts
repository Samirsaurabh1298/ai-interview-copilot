export interface UserRecord {
  id: string;
  authSubject: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
  status: "active" | "suspended" | "pending";
}

export interface UserPreferencesRecord {
  userId: string;
  defaultProvider: "anthropic" | "google" | "openai" | "mock";
  defaultModel: string;
  responseStyle: "concise" | "detailed";
  historyEnabled: boolean;
  updatedAt: Date;
}

export interface UsageEventRecord {
  id: string;
  userId?: string;
  provider: string;
  model: string;
  operation: "generate_answer" | "extract_vision" | "code_validation";
  inputUnits: number;
  outputUnits: number;
  estimatedCostUsd: number;
  status: "success" | "failure" | "timeout";
  createdAt: Date;
}

export interface SessionRecord {
  id: string;
  userId: string;
  title: string;
  taskType: string;
  provider: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface SessionMessageRecord {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
