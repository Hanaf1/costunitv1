import { GoogleGenAI, ThinkingLevel } from "@google/genai";

// Urutan dicoba dari yang tercepat. Model yang gagal otomatis dilewati dan
// sistem pindah ke model berikutnya. Bisa diganti lewat env GEMINI_MODELS.
const GEMINI_MODELS = (
  process.env.GEMINI_MODELS ??
  "gemini-3.5-flash-lite,gemini-flash-lite-latest,gemini-3.6-flash,gemini-3.5-flash,gemini-flash-latest,gemini-3.1-flash-lite"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

// Kalau model yang sedang berjalan belum menjawab setelah sekian detik, model
// berikutnya ikut dijalankan paralel; jawaban yang datang duluan yang dipakai.
// Kuota free tier dihitung per model, jadi ini tidak menghabiskan kuota model yang sama.
const HEDGE_DELAY_MS = 8_000;
const MAX_PARALLEL = 3;
// Sisakan waktu di bawah maxDuration (60 dtk) function Vercel.
const TOTAL_BUDGET_MS = 55_000;
// Model yang kuotanya habis (429) diistirahatkan dulu; yang sibuk (503) sebentar saja.
const COOLDOWN_QUOTA_MS = 10 * 60_000;
const COOLDOWN_BUSY_MS = 60_000;

// Disimpan per instance server: request berikutnya langsung melewati model yang
// baru saja gagal, tanpa membuang waktu mencobanya lagi.
const cooldownUntil = new Map<string, number>();
const noThinkingLevel = new Set<string>();

function statusOf(error: unknown) {
  return (error as { status?: number })?.status;
}

export function isOverloaded(error: unknown) {
  const status = statusOf(error);
  return status === 503 || status === 429 || status === 500 || status === 504;
}

export function geminiClient() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY belum diset di server.");
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

type Request = Omit<Parameters<GoogleGenAI["models"]["generateContent"]>[0], "model">;
type Response = Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>;

async function callModel(ai: GoogleGenAI, request: Request, model: string, signal: AbortSignal): Promise<Response> {
  const withThinking = !noThinkingLevel.has(model);
  try {
    return await ai.models.generateContent({
      ...request,
      model,
      config: {
        ...request.config,
        // Ekstraksi formulir tidak butuh "berpikir" panjang; ini memangkas waktu.
        ...(withThinking ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } } : {}),
        abortSignal: signal,
      },
    });
  } catch (error) {
    // Model yang tidak mendukung thinkingLevel MINIMAL: ulangi tanpa pengaturan itu.
    if (withThinking && statusOf(error) === 400 && /thinking/i.test(String((error as Error)?.message))) {
      noThinkingLevel.add(model);
      return callModel(ai, request, model, signal);
    }
    throw error;
  }
}

export function generateWithRetry(
  ai: GoogleGenAI,
  request: Request,
): Promise<{ response: Response; model: string; ms: number }> {
  const started = Date.now();
  const ready = GEMINI_MODELS.filter((m) => (cooldownUntil.get(m) ?? 0) <= started);
  // Semua sedang diistirahatkan: tetap coba semuanya daripada langsung gagal.
  const queue = ready.length > 0 ? ready : GEMINI_MODELS;

  return new Promise((resolve, reject) => {
    const controllers: AbortController[] = [];
    let next = 0;
    let running = 0;
    let done = false;
    let lastError: unknown;
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined;

    function finish(result: { ok: true; response: Response; model: string } | { ok: false; error: unknown }) {
      if (done) return;
      done = true;
      clearTimeout(hedgeTimer);
      clearTimeout(budgetTimer);
      for (const c of controllers) c.abort();
      if (result.ok) resolve({ response: result.response, model: result.model, ms: Date.now() - started });
      else reject(result.error);
    }

    function launch() {
      clearTimeout(hedgeTimer);
      if (done) return;
      if (next >= queue.length) {
        if (running === 0) finish({ ok: false, error: lastError ?? Object.assign(new Error("Semua model Gemini sedang sibuk."), { status: 503 }) });
        return;
      }
      if (running >= MAX_PARALLEL) {
        hedgeTimer = setTimeout(launch, HEDGE_DELAY_MS);
        return;
      }

      const model = queue[next++];
      const controller = new AbortController();
      controllers.push(controller);
      running++;

      callModel(ai, request, model, controller.signal).then(
        (response) => {
          cooldownUntil.delete(model);
          finish({ ok: true, response, model });
        },
        (error) => {
          running--;
          if (done) return;
          lastError = error;
          const status = statusOf(error);
          if (status !== 404 && !isOverloaded(error)) return finish({ ok: false, error });
          // Model tidak ada / kuota habis: istirahatkan lama. Sibuk: sebentar.
          cooldownUntil.set(model, Date.now() + (status === 503 || status === 500 ? COOLDOWN_BUSY_MS : COOLDOWN_QUOTA_MS));
          console.warn(`Gemini ${model} gagal (${status}), pindah ke model berikutnya.`);
          launch();
        },
      );

      hedgeTimer = setTimeout(launch, HEDGE_DELAY_MS);
    }

    const budgetTimer = setTimeout(
      () => finish({ ok: false, error: Object.assign(new Error("Gemini terlalu lama merespons. Coba lagi."), { status: 504 }) }),
      TOTAL_BUDGET_MS,
    );
    launch();
  });
}

// Model kadang membungkus JSON dengan ```json ... ```.
export function parseJsonResponse(text: string | undefined): unknown {
  let clean = (text ?? "").trim();
  if (clean.startsWith("```")) clean = clean.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(clean || "{}");
}
