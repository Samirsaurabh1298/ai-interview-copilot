import OpenAI from "openai";
import {
  QuestionExtractionResponseSchema,
  type QuestionExtractionResponse,
} from "@ai-copilot/contracts";
import { AIProviderError } from "@ai-copilot/ai-core";

const EXTRACTION_SYSTEM_PROMPT = `You are a specialized code and text extractor for technical interview questions.
Extract the question title, full problem description, code snippet, language, and test cases if present.
Return valid JSON matching this schema:
{
  "rawText": string,
  "cleanedQuestion": string,
  "codeSnippet": string (optional),
  "languageHint": string (optional),
  "confidence": number (between 0.0 and 1.0),
  "ambiguities": string[] (optional),
  "requiresUserCorrection": boolean
}`;

export async function extractQuestionWithGroq(
  client: OpenAI,
  imageInput: string,
  model = "qwen/qwen3.8-27b"
): Promise<QuestionExtractionResponse> {
  try {
    const isDataUri = imageInput.startsWith("data:");
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: isDataUri
            ? [
                { type: "text", text: "Extract the programming question from this image:" },
                { type: "image_url", image_url: { url: imageInput } },
              ]
            : `Extract the programming question from this text content:\n\n${imageInput}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message.content;
    if (!content) {
      throw new AIProviderError({
        message: "Groq returned empty extraction content",
        code: "INVALID_RESPONSE_SCHEMA",
        provider: "groq",
        isRetryable: true,
      });
    }

    const parsed = JSON.parse(content);
    const validated = QuestionExtractionResponseSchema.safeParse(parsed);
    if (!validated.success) {
      return {
        rawText: content,
        cleanedQuestion: content.slice(0, 500),
        confidence: 0.7,
        ambiguities: [],
        requiresUserCorrection: false,
      };
    }

    return validated.data;
  } catch (err: unknown) {
    if (err instanceof AIProviderError) throw err;
    throw new AIProviderError({
      message: err instanceof Error ? err.message : "Failed to extract question via Groq",
      code: "PROVIDER_UNAVAILABLE",
      provider: "groq",
      isRetryable: true,
      cause: err,
    });
  }
}
