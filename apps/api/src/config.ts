import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DEFAULT_AI_PROVIDER: z.enum(["openai", "anthropic", "google", "groq", "grok", "mock"]).default("groq"),
  DEFAULT_AI_MODEL: z.string().default("qwen/qwen3.8-27b"),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  CODE_RUNNER_URL: z.string().url().default("http://localhost:4100"),
  CODE_RUNNER_SECRET: z.string().default("default-secure-code-runner-auth-token-32chars"),
  RUNNER_EXECUTION_ENABLED: z
    .string()
    .optional()
    .transform((val) => {
      if (val !== undefined) return val === "true" || val === "1";
      return process.env.NODE_ENV === "test";
    }),
  JWT_SECRET: z.string().default("default-secure-pilot-assessment-jwt-secret-key-32chars"),
  DATABASE_URL: z.string().optional(),
  APP_BASE_URL: z.string().default("http://localhost:5173"),
  EMAIL_PROVIDER: z.enum(["smtp", "resend", "console", "test"]).optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((val) => val === "true" || val === "1"),
  EMAIL_FROM: z.string().default("AI Interview Copilot <noreply@ai-copilot.local>"),
  RESEND_API_KEY: z.string().optional(),
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(): AppConfig {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Configuration validation failed:", result.error.format());
    throw new Error("Invalid environment configuration");
  }
  return result.data;
}

