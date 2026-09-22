import { GoogleGenAI } from "@google/genai";

// Model utama dulu, lalu cadangan kalau model utama sedang penuh (503/429).
const GEMINI_MODELS = (process.env.GEMINI_MODELS ?? "gemini-3.6-flash,gemini-3.5-flash,gemini-flash-latest")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

export function isOverloaded(error: unknown) {
  const status = (error as { status?: number })?.status;
  return status === 503 || status === 429 || status === 500;
}

export function geminiClient() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY belum diset di server.");
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

export async function generateWithRetry(
  ai: GoogleGenAI,
  request: Omit<Parameters<GoogleGenAI["models"]["generateContent"]>[0], "model">,
) {
  let lastError: unknown;
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({ ...request, model });
      } catch (error) {
        lastError = error;
        if (!isOverloaded(error)) throw error;
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

// Model kadang membungkus JSON dengan ```json ... ```.
export function parseJsonResponse(text: string | undefined): unknown {
  let clean = (text ?? "").trim();
  if (clean.startsWith("```")) clean = clean.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(clean || "{}");
}
