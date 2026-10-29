import type Anthropic from "@anthropic-ai/sdk";
import type {
  QuestionExtractionRequest,
  QuestionExtractionResponse,
} from "@ai-copilot/contracts";
import { QuestionExtractionResponseSchema } from "@ai-copilot/contracts";
import { AIProviderError } from "@ai-copilot/ai-core";

const CLAUDE_SONNET_MODEL = "claude-3-5-sonnet-20241022";

const EXTRACTION_TOOL_SCHEMA: Anthropic.Tool = {
  name: "submit_question_extraction",
  description:
    "Extract clean text, code snippets, constraints, and ambiguities from a coding problem screenshot.",
  input_schema: {
    type: "object",
    properties: {
      rawText: {
        type: "string",
        description: "Exact transcript of all visible text",
      },
      cleanedQuestion: {
        type: "string",
        description: "Normalized and cleaned problem statement without UI artifacts",
      },
      codeSnippet: {
        type: "string",
        description: "Extracted code block or starter function preserving indentation",
      },
      languageHint: {
        type: "string",
        description: "Detected programming language, e.g. typescript, python, javascript",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "Extraction confidence score",
      },
      ambiguities: {
        type: "array",
        items: { type: "string" },
        description: "List of cut-off lines or unreadable characters",
      },
      requiresUserCorrection: {
        type: "boolean",
        description: "True if key constraints or code lines are ambiguous",
      },
    },
    required: ["rawText", "cleanedQuestion", "confidence", "requiresUserCorrection"],
  },
};

export async function extractQuestionWithClaude(
  client: Anthropic,
  request: QuestionExtractionRequest
): Promise<QuestionExtractionResponse> {
  // Strip data URL prefix if present (e.g. "data:image/png;base64,")
  const base64Data = request.imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

  try {
    const response = await client.messages.create({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: 2048,
      system:
        "You are an expert OCR and technical document analysis engine. Extract programming problem statements, code blocks with exact indentation, and constraints from the provided image. Never guess cut-off code; report ambiguities explicitly.",
      tools: [EXTRACTION_TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "submit_question_extraction" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: request.mimeType,
                data: base64Data,
              },
            },
            {
              type: "text",
              text: request.userHint
                ? `Context hint: ${request.userHint}. Extract the question and code accurately.`
                : "Extract the problem statement and any code snippets accurately.",
            },
          ],
        },
      ],
    });

    const toolUseBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      throw new AIProviderError({
        message: "Claude Vision did not return structured extraction payload.",
        code: "INVALID_RESPONSE_SCHEMA",
        provider: "anthropic",
        isRetryable: true,
      });
    }

    const parsed = QuestionExtractionResponseSchema.safeParse(toolUseBlock.input);
    if (!parsed.success) {
      throw new AIProviderError({
        message: `Claude Vision output failed validation: ${parsed.error.message}`,
        code: "INVALID_RESPONSE_SCHEMA",
        provider: "anthropic",
        isRetryable: true,
      });
    }

    return parsed.data;
  } catch (err: unknown) {
    if (err instanceof AIProviderError) throw err;
    throw new AIProviderError({
      message: err instanceof Error ? err.message : "Vision extraction failed",
      code: "PROVIDER_UNAVAILABLE",
      provider: "anthropic",
      isRetryable: false,
      cause: err,
    });
  }
}
