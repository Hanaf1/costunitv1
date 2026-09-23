import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createWorker } from "tesseract.js";
import fuzzysort from "fuzzysort";
import { geminiClient, generateWithRetry, isOverloaded, parseJsonResponse } from "@/lib/gemini";

// OCR & panggilan Gemini bisa lebih dari batas default function Vercel.
export const maxDuration = 60;

type OcrWord = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

type OcrLine = Omit<OcrWord, "text"> & { text: string; words: OcrWord[] };

function normaliseOcrText(value: string) {
  return value.toLocaleLowerCase("id-ID").replace(/[^a-z0-9]/g, "");
}

function flattenOcrLines(blocks: unknown): OcrLine[] {
  if (!Array.isArray(blocks)) return [];

  const lines: OcrLine[] = [];
  for (const block of blocks as Array<{ paragraphs?: Array<{ lines?: OcrLine[] }> }>) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        if (line.text.trim()) lines.push(line);
      }
    }
  }
  return lines;
}

function closestMaster<T extends { target: string }>(text: string, targets: T[], minimumScore: number) {
  const cleaned = normaliseOcrText(text);
  if (cleaned.length < 3) return null;

  const exact = targets.find((target) => normaliseOcrText(target.target) === cleaned);
  if (exact) return exact;

  const result = fuzzysort.go(text, targets, { key: "target", threshold: minimumScore, limit: 1 })[0];
  return result && result.score >= minimumScore ? result.obj : null;
}

function parseQuantity(text: string) {
  // Hanya angka dan pemisah umum yang diterima. Ini mencegah karakter OCR acak
  // (mis. "MONDDII") berubah menjadi jumlah barang yang salah.
  if (!/^\s*[0-9][0-9\s/.,-]*\s*$/.test(text)) return null;
  const digits = text.replace(/\D/g, "");
  if (!digits) return null;
  const quantity = Number.parseInt(digits, 10);
  return Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 10000 ? quantity : null;
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
      const ai = geminiClient();
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

      const { response, model, ms } = await generateWithRetry(ai, {
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

      let result;
      try {
        result = parseJsonResponse(response.text);
      } catch {
        console.error("Failed to parse JSON from AI. Raw response:", response.text);
        return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
      }

      return NextResponse.json({ ...(result as object), model, ms });
    } 
    
    else if (engine === "local") {
      // OCR lokal tidak cukup aman bila seluruh halaman diperlakukan sebagai satu
      // kalimat. Form ini memiliki kolom tetap, jadi baca posisi setiap baris dan
      // gunakan hanya teks di kolom Nama Barang dan Jumlah.
      // Filesystem Vercel read-only kecuali /tmp: simpan cache bahasa di sana.
      const worker = await createWorker("ind+eng", 1, { cachePath: "/tmp" });
      const ret = await worker.recognize(buffer, {}, { text: true, blocks: true });
      await worker.terminate();

      const lines = flattenOcrLines(ret.data.blocks);
      const unitTargets = units.map((unit) => ({ ...unit, target: unit.namaUnit }));
      const barangTargets = barang.map((item) => ({ ...item, target: item.namaBarang }));
      const warnings: string[] = ["Hasil Scan Foto (Lokal) perlu dicek sebelum disimpan, terutama tulisan tangan."];

      const ruangLine = lines.find((line) => normaliseOcrText(line.text).includes("ruang"));
      const ruangValue = ruangLine?.text.replace(/.*ruang\s*:?\s*/i, "") ?? "";
      // Ambang ketat: nama unit yang tidak cukup mirip tidak akan mengganti pilihan pengguna.
      const unitMatch = closestMaster(ruangValue, unitTargets, -350);

      const pageLeft = Math.min(...lines.map((line) => line.bbox.x0));
      const pageRight = Math.max(...lines.map((line) => line.bbox.x1));
      const pageWidth = pageRight - pageLeft;
      const tableTop = (ruangLine?.bbox.y1 ?? 0) + 24;
      const footerLine = lines.find((line) => normaliseOcrText(line.text).includes("petugaslogistik"));
      const tableBottom = (footerLine?.bbox.y0 ?? Number.POSITIVE_INFINITY) - 12;
      const itemStart = pageLeft + pageWidth * 0.34;
      const quantityStart = pageLeft + pageWidth * 0.78;
      const detectedItems = new Map<string, number>();

      for (const line of lines) {
        if (line.bbox.y0 < tableTop || line.bbox.y1 > tableBottom) continue;

        const itemWords = line.words.filter((word) => {
          const middle = (word.bbox.x0 + word.bbox.x1) / 2;
          return middle >= itemStart && middle < quantityStart;
        });
        const quantityWords = line.words.filter((word) => {
          const middle = (word.bbox.x0 + word.bbox.x1) / 2;
          return middle >= quantityStart;
        });
        const itemText = itemWords.map((word) => word.text).join(" ").trim();
        const quantityText = quantityWords.map((word) => word.text).join("").trim();
        const quantity = parseQuantity(quantityText);
        // Ambang lebih ketat daripada scanner lama supaya teks rusak tidak tersambung
        // ke barang master yang keliru.
        const itemMatch = closestMaster(itemText, barangTargets, -220);

        if (!itemMatch || !quantity) continue;
        detectedItems.set(itemMatch.id, (detectedItems.get(itemMatch.id) ?? 0) + quantity);
      }

      if (!unitMatch && ruangValue) warnings.push("Unit tidak cukup jelas untuk dipilih otomatis.");
      if (detectedItems.size === 0) warnings.push("Tidak ada baris dengan nama barang dan jumlah yang cukup jelas. Ambil foto lebih tegak dan dekat, lalu isi baris yang belum terbaca secara manual.");

      return NextResponse.json({
        unitId: unitMatch?.id ?? null,
        items: [...detectedItems].map(([barangId, jumlahBarang]) => ({ barangId, jumlahBarang })),
        warnings,
        reviewRequired: true,
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
