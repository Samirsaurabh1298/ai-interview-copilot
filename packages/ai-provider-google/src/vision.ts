import type { GoogleGenAI } from "@google/genai";
import type {
  QuestionExtractionRequest,
  QuestionExtractionResponse,
} from "@ai-copilot/contracts";
import { QuestionExtractionResponseSchema } from "@ai-copilot/contracts";
import { AIProviderError } from "@ai-copilot/ai-core";

const GEMINI_FLASH_MODEL = "gemini-2.0-flash";

export async function extractQuestionWithGemini(
  client: GoogleGenAI,
  request: QuestionExtractionRequest
): Promise<QuestionExtractionResponse> {
  const cleanBase64 = request.imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

  try {
    const prompt = `Extract all text, programming problem statements, and code blocks from this screenshot.
Return strictly a JSON object with this schema:
{
  "rawText": string,
  "cleanedQuestion": string,
  "codeSnippet": string (optional),
  "languageHint": string (optional),
  "confidence": number (0.0 to 1.0),
  "ambiguities": string[],
  "requiresUserCorrection": boolean
}`;

    const response = await client.models.generateContent({
      model: GEMINI_FLASH_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: request.mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const rawText = response.text;
    if (!rawText) {
      throw new AIProviderError({
        message: "Gemini Vision returned empty text",
        code: "INVALID_RESPONSE_SCHEMA",
        provider: "google",
        isRetryable: true,
      });
    }

    const parsedJson = JSON.parse(rawText);
    const validated = QuestionExtractionResponseSchema.safeParse(parsedJson);
    if (!validated.success) {
      throw new AIProviderError({
        message: `Gemini extraction failed validation: ${validated.error.message}`,
        code: "INVALID_RESPONSE_SCHEMA",
        provider: "google",
        isRetryable: true,
      });
    }

    return validated.data;
  } catch (err: unknown) {
    if (err instanceof AIProviderError) throw err;
    throw new AIProviderError({
      message: err instanceof Error ? err.message : "Gemini vision extraction failed",
      code: "PROVIDER_UNAVAILABLE",
      provider: "google",
      isRetryable: false,
      cause: err,
    });
  }
}
