import { NextRequest, NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { geminiClient, generateWithRetry, isOverloaded, parseJsonResponse } from "@/lib/gemini";

export const maxDuration = 60;

export type ScannedForm = {
  ruangTeks: string;
  unitId: string | null;
  tanggal: string | null; // YYYY-MM-DD
  items: { teks: string; barangId: string | null; jumlah: number }[];
};

function buildPrompt(unitList: string, barangList: string, tahun: number) {
  return `
Anda asisten data entry logistik rumah sakit. Foto berisi SATU ATAU LEBIH lembar "Formulir Permintaan Barang"
tulisan tangan, masing-masing dari unit/ruang yang berbeda. Baca SETIAP formulir secara terpisah.

Daftar Unit Master:
---
${unitList}
---

Daftar Barang Master:
---
${barangList}
---

Aturan:
1. Satu formulir = satu elemen "forms". Urutkan dari kiri-atas ke kanan-bawah.
2. Unit: pakai isian "Ruang" (utamakan) atau "Nama Pasien" bila Ruang kosong. Salin tulisan aslinya ke "ruangTeks",
   lalu cocokkan ke Unit Master (nama mirip/singkatan/salah eja). Tidak yakin -> unitId null.
3. Tanggal: biasanya ditulis sekali di baris pertama, berlaku untuk seluruh formulir. Format tulisan d/m, d/m/yy,
   atau d/m/yyyy. Tahun kosong -> ${tahun}. Kembalikan "YYYY-MM-DD", atau null jika tidak terbaca.
4. Barang: salin tulisan aslinya ke "teks", cocokkan ke Barang Master (barangId, atau null bila tidak ada yang cocok).
5. Baris berisi dua barang dengan jumlah "x / y" (contoh "Tisu besar / kecil 5/5", "amplop kecil/besar 10/5")
   dipecah menjadi DUA item, masing-masing dengan jumlahnya sendiri.
6. Baris yang DICORET diabaikan. Baris tanpa jumlah -> jumlah 1.
7. Jumlah hanya angka (abaikan satuan seperti "pack", "pcs").

Kembalikan HANYA JSON:
{"forms":[{"ruangTeks":"...","unitId":"...|null","tanggal":"YYYY-MM-DD|null",
  "items":[{"teks":"...","barangId":"...|null","jumlah":1}]}]}
`;
}

export async function POST(req: NextRequest) {
  if (!(await getSessionUsername())) return NextResponse.json({ error: "Sesi habis, silakan login ulang." }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Foto belum dipilih." }, { status: 400 });

    const [units, barang] = await Promise.all([
      prisma.unit.findMany({ where: { status: "Aktif" }, select: { id: true, namaUnit: true, kodeUnit: true } }),
      prisma.barang.findMany({ where: { status: "Aktif" }, select: { id: true, namaBarang: true, satuanDasar: true } }),
    ]);

    const prompt = buildPrompt(
      units.map((u) => `${u.id} | ${u.namaUnit} | ${u.kodeUnit}`).join("\n"),
      barang.map((b) => `${b.id} | ${b.namaBarang} | ${b.satuanDasar}`).join("\n"),
      new Date().getFullYear(),
    );

    const response = await generateWithRetry(geminiClient(), {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { data: Buffer.from(await file.arrayBuffer()).toString("base64"), mimeType: file.type || "image/jpeg" } },
          ],
        },
      ],
      config: { responseMimeType: "application/json", temperature: 0.1 },
    });

    let raw: unknown;
    try {
      raw = parseJsonResponse(response.text);
    } catch {
      console.error("scan-batch: respons AI bukan JSON:", response.text);
      return NextResponse.json({ error: "Hasil baca AI tidak valid. Coba foto ulang lebih jelas." }, { status: 502 });
    }

    // Validasi: ID yang tidak ada di master dianggap tidak cocok.
    const unitIds = new Set(units.map((u) => u.id));
    const barangIds = new Set(barang.map((b) => b.id));
    const rawForms = (raw as { forms?: unknown[] })?.forms;
    const forms: ScannedForm[] = (Array.isArray(rawForms) ? rawForms : []).map((f) => {
      const form = (f ?? {}) as Record<string, unknown>;
      const items = Array.isArray(form.items) ? (form.items as Record<string, unknown>[]) : [];
      const tanggal = typeof form.tanggal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(form.tanggal) ? form.tanggal : null;
      return {
        ruangTeks: String(form.ruangTeks ?? ""),
        unitId: typeof form.unitId === "string" && unitIds.has(form.unitId) ? form.unitId : null,
        tanggal,
        items: items.map((it) => ({
          teks: String(it?.teks ?? ""),
          barangId: typeof it?.barangId === "string" && barangIds.has(it.barangId) ? it.barangId : null,
          jumlah: Math.max(1, Math.round(Number(it?.jumlah)) || 1),
        })),
      };
    });

    return NextResponse.json({ forms });
  } catch (error) {
    console.error("scan-batch error:", error);
    const message = isOverloaded(error)
      ? "Layanan Gemini sedang sibuk. Coba lagi beberapa saat."
      : error instanceof Error
        ? error.message
        : "Gagal memproses foto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
