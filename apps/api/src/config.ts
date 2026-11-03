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
  JWT_SECRET: z.string().default("default-secure-pilot-assessment-jwt-secret-key-32chars"),
  DATABASE_URL: z.string().optional(),
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

