import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createWorker } from "tesseract.js";
import fuzzysort from "fuzzysort";
import { GoogleGenAI } from "@google/genai";

// OCR & panggilan Gemini bisa lebih dari batas default function Vercel.
export const maxDuration = 60;

// Model utama dulu, lalu cadangan kalau model utama sedang penuh (503/429).
const GEMINI_MODELS = (process.env.GEMINI_MODELS ?? "gemini-3.6-flash,gemini-3.5-flash,gemini-flash-latest")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

function isOverloaded(error: unknown) {
  const status = (error as { status?: number })?.status;
  return status === 503 || status === 429 || status === 500;
}

async function generateWithRetry(
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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const engine = formData.get("engine") as string || "gemini";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Fetch master data for context (used by both engines)
    const [units, barang] = await Promise.all([
      prisma.unit.findMany({ where: { status: "Aktif" }, select: { id: true, namaUnit: true, kodeUnit: true } }),
      prisma.barang.findMany({ where: { status: "Aktif" }, select: { id: true, namaBarang: true, kodeItem: true, satuanDasar: true } }),
    ]);

    if (engine === "gemini") {
      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({ error: "GEMINI_API_KEY belum diset di server." }, { status: 500 });
      }
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const base64Data = buffer.toString("base64");
      
      const unitListText = units.map(u => `ID: ${u.id} | Nama: ${u.namaUnit} | Kode: ${u.kodeUnit}`).join("\n");
      const barangListText = barang.map(b => `ID: ${b.id} | Nama: ${b.namaBarang} | Kode: ${b.kodeItem} | Satuan: ${b.satuanDasar}`).join("\n");

      const prompt = `
Anda adalah asisten data entry yang ahli. Saya akan memberikan foto formulir permintaan barang.
Tugas Anda adalah membaca tabel atau daftar barang yang diminta beserta jumlahnya, dan mengidentifikasi unit peminta.

Berikut adalah daftar Unit Master Data:
---
${unitListText}
---

Berikut adalah daftar Barang Master Data:
---
${barangListText}
---

Instruksi:
1. Identifikasi nama Unit dari formulir, cocokkan dengan daftar Unit Master Data (cari kecocokan terdekat). Jika ketemu, catat ID-nya.
2. Identifikasi setiap baris barang yang diminta. Cocokkan nama barang di form dengan daftar Barang Master Data (cari kecocokan terdekat/sinonim).
3. Jika Anda tidak yakin atau tidak menemukan kecocokan yang sangat baik, Anda tetap boleh menebak ID terdekat, atau kosongkan ID-nya jika benar-benar tidak jelas.
4. Kembalikan respons murni dalam format JSON (tanpa markdown) dengan struktur berikut:
{
  "unitId": "ID_UNIT_YANG_COCOK_ATAU_NULL",
  "items": [
    {
      "barangId": "ID_BARANG_YANG_COCOK_ATAU_NULL",
      "jumlahBarang": ANGKA_JUMLAH
    }
  ]
}
`;

      const response = await generateWithRetry(ai, {
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: base64Data,
                  mimeType: file.type,
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      const text = response.text || "";
      let cleanText = text.trim();
      if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, "");
      }
      
      let result;
      try {
        result = JSON.parse(cleanText || "{}");
      } catch (e) {
        console.error("Failed to parse JSON from AI. Raw response:", text);
        return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
      }

      return NextResponse.json(result);
    } 
    
    else if (engine === "local") {
      // Run Tesseract.js (Offline OCR)
      // Filesystem Vercel read-only kecuali /tmp: simpan cache data bahasa di sana.
      const worker = await createWorker("ind", 1, { cachePath: "/tmp" });
      const ret = await worker.recognize(buffer);
      const ocrText = ret.data.text;
      await worker.terminate();

      const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l.length > 2);

      const unitTargets = units.map(u => ({ ...u, target: u.namaUnit }));
      const barangTargets = barang.map(b => ({ ...b, target: b.namaBarang }));

      let detectedUnitId: string | null = null;
      const detectedItems: { barangId: string; jumlahBarang: number }[] = [];

      for (const line of lines) {
        if (!detectedUnitId) {
          const unitMatch = fuzzysort.go(line, unitTargets, { key: 'target', threshold: -100 });
          if (unitMatch.length > 0 && unitMatch[0].score > -1500) {
            detectedUnitId = unitMatch[0].obj.id;
          }
        }

        const barangMatch = fuzzysort.go(line, barangTargets, { key: 'target', threshold: -2000 });
        if (barangMatch.length > 0 && barangMatch[0].score > -1000) {
          const numberMatch = line.match(/\b(\d+)\b/);
          let jumlah = 1;
          if (numberMatch && numberMatch[1]) {
            jumlah = parseInt(numberMatch[1], 10);
          }

          detectedItems.push({
            barangId: barangMatch[0].obj.id,
            jumlahBarang: jumlah
          });
        }
      }

      return NextResponse.json({
        unitId: detectedUnitId,
        items: detectedItems
      });
    }

    return NextResponse.json({ error: "Invalid engine" }, { status: 400 });

  } catch (error) {
    console.error("Scan form error:", error);
    const message = isOverloaded(error)
      ? "Layanan Gemini sedang sibuk. Coba lagi beberapa saat, atau pakai Scan Foto (Lokal)."
      : error instanceof Error
        ? error.message
        : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
