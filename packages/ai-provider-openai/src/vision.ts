import type OpenAI from "openai";
import type {
  QuestionExtractionRequest,
  QuestionExtractionResponse,
} from "@ai-copilot/contracts";
import { QuestionExtractionResponseSchema } from "@ai-copilot/contracts";
import { AIProviderError } from "@ai-copilot/ai-core";

const GPT_4O_MODEL = "gpt-4o";

export async function extractQuestionWithOpenAI(
  client: OpenAI,
  request: QuestionExtractionRequest
): Promise<QuestionExtractionResponse> {
  const formattedUrl = request.imageBase64.startsWith("data:")
    ? request.imageBase64
    : `data:${request.mimeType};base64,${request.imageBase64}`;

  try {
    const prompt = `Extract all text, programming problem statements, constraints, and code blocks from this screenshot.
Return strictly a JSON object matching this schema:
{
  "rawText": string,
  "cleanedQuestion": string,
  "codeSnippet": string (optional),
  "languageHint": string (optional),
  "confidence": number (0.0 to 1.0),
  "ambiguities": string[],
  "requiresUserCorrection": boolean
}`;

    const completion = await client.chat.completions.create({
      model: GPT_4O_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: formattedUrl,
                detail: "high",
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message.content;
    if (!content) {
      throw new AIProviderError({
        message: "OpenAI Vision returned empty text",
        code: "INVALID_RESPONSE_SCHEMA",
        provider: "openai",
        isRetryable: true,
      });
    }

    const parsedJson = JSON.parse(content);
    const validated = QuestionExtractionResponseSchema.safeParse(parsedJson);
    if (!validated.success) {
      throw new AIProviderError({
        message: `OpenAI vision extraction failed validation: ${validated.error.message}`,
        code: "INVALID_RESPONSE_SCHEMA",
        provider: "openai",
        isRetryable: true,
      });
    }

    return validated.data;
  } catch (err: unknown) {
    if (err instanceof AIProviderError) throw err;
    throw new AIProviderError({
      message: err instanceof Error ? err.message : "OpenAI vision extraction failed",
      code: "PROVIDER_UNAVAILABLE",
      provider: "openai",
      isRetryable: false,
      cause: err,
    });
  }
}
