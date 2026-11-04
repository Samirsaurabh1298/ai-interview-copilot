import { z } from "zod";
import { ProgrammingLanguageSchema } from "./validation.js";

// ==============================================================================
// 1. Task Type Identifiers
// ==============================================================================

export const AssessmentTaskTypeSchema = z.enum([
  "question_set",
  "coding_challenge",
  "repository_task",
]);
export type AssessmentTaskType = z.infer<typeof AssessmentTaskTypeSchema>;

// Virtual File Interface for Multi-File Repository Tasks
export interface VirtualFile {
  path: string;
  content: string;
  isReadOnly?: boolean;
}

// ==============================================================================
// 2. Task-Level AI Assistance Policy
// ==============================================================================

export const TaskAIPolicyModeSchema = z.enum([
  "prohibited",
  "full_copilot",
  "restricted_explainer",
]);
export type TaskAIPolicyMode = z.infer<typeof TaskAIPolicyModeSchema>;

export const TaskAIPolicySchema = z.object({
  enabled: z.boolean().default(false),
  mode: TaskAIPolicyModeSchema.default("prohibited"),
  allowedModel: z.string().default("gpt-4o-mini"),
  maxBudgetUsd: z.number().min(0.01).max(5.0).default(0.15),
  candidateDisclosure: z
    .string()
    .default("AI assistance is configured by the hiring company for this specific task."),
  disclosureNotice: z.string().optional(),
});
export type TaskAIPolicy = z.infer<typeof TaskAIPolicySchema>;

// ==============================================================================
// 3. Question Set Task Configuration
// ==============================================================================

export const QuestionFormatSchema = z.enum([
  "multiple_choice",
  "multiple_select",
  "short_text",
  "mcq_single",
  "mcq_multi",
]);
export type QuestionFormat = z.infer<typeof QuestionFormatSchema>;

export const QuestionOptionSchema = z.union([
  z.string(),
  z.object({
    id: z.string(),
    text: z.string(),
    isCorrect: z.boolean().optional(),
  }),
]);
export type QuestionOption = z.infer<typeof QuestionOptionSchema>;

export const QuestionItemSchema = z.object({
  id: z.string(),
  title: z.string().min(2).max(160).optional(),
  prompt: z.string().min(5),
  format: QuestionFormatSchema.default("multiple_choice"),
  options: z.array(QuestionOptionSchema).default([]),
  correctOptionIndexes: z.array(z.number().int().min(0)).default([]),
  maxCharacters: z.number().int().min(50).max(5000).optional(),
  charLimit: z.number().int().optional(),
  marks: z.number().int().min(1).max(100).default(10),
  points: z.number().int().optional(),
  required: z.boolean().default(true),
  isRequired: z.boolean().optional(),
  difficulty: z.enum(["junior", "mid", "senior", "staff"]).default("mid"),
  evaluationCriteria: z.string().optional(),
  explanation: z.string().optional(),
});
export type QuestionItem = z.infer<typeof QuestionItemSchema>;

export const QuestionSetTaskConfigSchema = z.object({
  questions: z.array(QuestionItemSchema).min(1, "Question set must contain at least 1 question"),
  randomizeQuestionOrder: z.boolean().default(false),
});
export type QuestionSetTaskConfig = z.infer<typeof QuestionSetTaskConfigSchema>;

// ==============================================================================
// 4. Coding Challenge Task Configuration
// ==============================================================================

export const CodingChallengeTestCaseSchema = z.object({
  name: z.string(),
  isHidden: z.boolean().default(false),
});
export type CodingChallengeTestCase = z.infer<typeof CodingChallengeTestCaseSchema>;

export const CodingChallengeTaskConfigSchema = z.object({
  problemStatement: z.string().optional(),
  language: ProgrammingLanguageSchema.default("typescript"),
  allowedLanguages: z.array(ProgrammingLanguageSchema).default(["typescript", "javascript", "python"]),
  starterCode: z.string().min(1, "Starter code cannot be empty"),
  verificationTestCode: z.string().min(1, "Verification test suite is required"),
  hiddenTestCode: z.string().optional(),
  testCases: z.array(CodingChallengeTestCaseSchema).default([]),
  publicTestCode: z.string().optional(),
  solutionCode: z.string().optional(),
  executionTimeoutMs: z.number().int().min(1000).max(15000).default(4000),
  scoringRubric: z
    .record(z.string(), z.number().min(1).max(50))
    .default({
      "algorithmic-correctness": 35,
      "code-quality": 25,
      "edge-case-handling": 20,
      "time-space-complexity": 20,
    }),
});
export type CodingChallengeTaskConfig = z.infer<typeof CodingChallengeTaskConfigSchema>;

// ==============================================================================
// 5. Repository / Codebase Task Configuration
// ==============================================================================

export const RepositoryTaskActionSchema = z.enum([
  "debug",
  "implement",
  "refactor",
  "code_review",
  "write_tests",
]);
export type RepositoryTaskAction = z.infer<typeof RepositoryTaskActionSchema>;

export const RepositoryTaskConfigSchema = z.object({
  taskDescription: z.string().optional(),
  action: RepositoryTaskActionSchema.optional(),
  taskAction: RepositoryTaskActionSchema.default("implement"),
  targetLanguage: ProgrammingLanguageSchema.default("typescript"),
  starterFiles: z.record(z.string(), z.string()).default({}),
  primaryFileToEdit: z.string().default("src/index.ts"),
  primaryFilePath: z.string().optional(),
  fileTree: z
    .array(
      z.object({
        path: z.string(),
        content: z.string(),
        isReadOnly: z.boolean().optional(),
      })
    )
    .default([]),
  verificationTestCode: z.string().min(1, "Verification test suite is required"),
  acceptanceCriteria: z.array(z.string()).default([]),
  permittedDocumentationUrls: z.array(z.string()).default([]),
});
export type RepositoryTaskConfig = z.infer<typeof RepositoryTaskConfigSchema>;

// ==============================================================================
// 6. Unified Assessment Task Contract
// ==============================================================================

export const AssessmentTaskSchema = z.object({
  id: z.string(),
  type: AssessmentTaskTypeSchema,
  title: z.string().min(3).max(120),
  description: z.string().min(5),
  order: z.number().int().min(0).optional(),
  orderIndex: z.number().int().optional(),
  durationMinutes: z.number().int().min(5).max(180).optional(),
  estimatedMinutes: z.number().int().optional(),
  weight: z.number().int().min(1).max(100).default(25),
  points: z.number().int().optional(),
  isRequired: z.boolean().optional(),
  aiPolicy: TaskAIPolicySchema.default({
    enabled: false,
    mode: "prohibited",
    allowedModel: "gpt-4o-mini",
    maxBudgetUsd: 0.15,
    candidateDisclosure: "AI assistance is prohibited for this foundational task.",
  }),
  config: z.any(),
});
export type AssessmentTask = z.infer<typeof AssessmentTaskSchema>;

// ==============================================================================
// 7. Candidate Task Submission Schema
// ==============================================================================

export const QuestionAnswerSubmissionSchema = z.object({
  questionId: z.string(),
  selectedOptionIndexes: z.array(z.number().int()).optional(),
  textResponse: z.string().optional(),
});
export type QuestionAnswerSubmission = z.infer<typeof QuestionAnswerSubmissionSchema>;

export const TaskSubmissionResultSchema = z.object({
  taskId: z.string(),
  taskType: AssessmentTaskTypeSchema,
  completedAt: z.coerce.date().default(() => new Date()),
  elapsedSeconds: z.number().int().min(0),
  questionAnswers: z.array(QuestionAnswerSubmissionSchema).optional(),
  finalCode: z.string().optional(),
  finalFiles: z.record(z.string(), z.string()).optional(),
  technicalExplanation: z.string().optional(),
  testResults: z
    .object({
      passed: z.number().int(),
      total: z.number().int(),
      tests: z.array(
        z.object({
          name: z.string(),
          passed: z.boolean(),
          error: z.string().optional(),
          durationMs: z.number().optional(),
        })
      ),
    })
    .optional(),
  aiTelemetry: z
    .object({
      queriesCount: z.number().int().default(0),
      budgetConsumedUsd: z.number().default(0),
      patchesAccepted: z.number().int().default(0),
      patchesRejected: z.number().int().default(0),
    })
    .default({
      queriesCount: 0,
      budgetConsumedUsd: 0,
      patchesAccepted: 0,
      patchesRejected: 0,
    }),
});
export type TaskSubmissionResult = z.infer<typeof TaskSubmissionResultSchema>;

// ==============================================================================
// 8. Candidate-Safe Scrubbing Helper
// ==============================================================================

/**
 * Removes hidden tests, correct answers, and private scoring keys from a task definition
 * before transmitting to candidate client.
 */
export function scrubTaskForCandidate(task: AssessmentTask): AssessmentTask {
  const scrubbed = JSON.parse(JSON.stringify(task)) as AssessmentTask;

  if (scrubbed.type === "question_set") {
    const qConfig = scrubbed.config as QuestionSetTaskConfig;
    if (qConfig && Array.isArray(qConfig.questions)) {
      qConfig.questions = qConfig.questions.map((q) => {
        const { correctOptionIndexes, evaluationCriteria, ...safeQuestion } = q;
        const safeOptions = Array.isArray(safeQuestion.options)
          ? safeQuestion.options.map((opt) =>
              typeof opt === "object" ? { id: opt.id, text: opt.text } : opt
            )
          : [];
        return { ...safeQuestion, options: safeOptions } as QuestionItem;
      });
    }
  } else if (scrubbed.type === "coding_challenge") {
    const cConfig = scrubbed.config as CodingChallengeTaskConfig;
    if (cConfig) {
      cConfig.verificationTestCode =
        cConfig.publicTestCode || "// Hidden verification tests will execute upon submission.";
      delete (cConfig as any).hiddenTestCode;
      delete (cConfig as any).solutionCode;
      if (Array.isArray(cConfig.testCases)) {
        cConfig.testCases = cConfig.testCases.filter((tc) => !tc.isHidden);
      }
    }
  } else if (scrubbed.type === "repository_task") {
    const rConfig = scrubbed.config as RepositoryTaskConfig;
    if (rConfig) {
      rConfig.verificationTestCode = "// Acceptance criteria tests will execute in isolated sandbox.";
    }
  }

  return scrubbed;
}
