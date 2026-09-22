"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { weekRange } from "@/lib/week";
import {
  findExistingPermintaan,
  savePermintaanMingguan,
  deletePermintaanMingguan,
  appendOrCreatePermintaan,
  type PermintaanItemInput,
} from "@/lib/services/permintaan";

export type PermintaanFormState = { error: string } | undefined;

function parseMingguValue(value: string): { tahun: number; mingguKe: number } | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) return null;
  return { tahun: Number(match[1]), mingguKe: Number(match[2]) };
}

export async function savePermintaanAction(
  _prev: PermintaanFormState,
  formData: FormData,
): Promise<PermintaanFormState> {
  await requireSession();

  const id = String(formData.get("id") ?? "").trim() || undefined;
  const unitId = String(formData.get("unitId") ?? "").trim();
  const mingguValue = String(formData.get("minggu") ?? "").trim();
  const itemsJsonRaw = String(formData.get("itemsJson") ?? "[]");

  if (!unitId) return { error: "Pilih unit terlebih dahulu." };

  const parsedWeek = parseMingguValue(mingguValue);
  if (!parsedWeek) return { error: "Pilih minggu permintaan terlebih dahulu." };

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(itemsJsonRaw);
  } catch {
    return { error: "Data baris item tidak valid." };
  }

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: "Tambahkan minimal 1 baris barang." };
  }

  const items: PermintaanItemInput[] = [];
  for (const raw of rawItems) {
    if (
      typeof raw !== "object" ||
      raw === null ||
      typeof (raw as Record<string, unknown>).barangId !== "string" ||
      typeof (raw as Record<string, unknown>).namaBarangSnapshot !== "string" ||
      typeof (raw as Record<string, unknown>).satuanSnapshot !== "string"
    ) {
      return { error: "Ada baris barang yang belum lengkap dipilih." };
    }
    const jumlahBarang = Number((raw as Record<string, unknown>).jumlahBarang);
    const hargaSatuan = Number((raw as Record<string, unknown>).hargaSatuan);
    const isiSnapshot = Number((raw as Record<string, unknown>).isiSnapshot ?? 1);
    if (!Number.isFinite(jumlahBarang) || jumlahBarang <= 0) {
      return { error: "Jumlah barang harus lebih dari 0 di setiap baris." };
    }
    if (!Number.isFinite(hargaSatuan) || hargaSatuan < 0) {
      return { error: "Harga satuan tidak valid di salah satu baris." };
    }
    items.push({
      barangId: (raw as Record<string, unknown>).barangId as string,
      namaBarangSnapshot: (raw as Record<string, unknown>).namaBarangSnapshot as string,
      satuanSnapshot: (raw as Record<string, unknown>).satuanSnapshot as string,
      isiSnapshot: Number.isFinite(isiSnapshot) && isiSnapshot >= 1 ? Math.round(isiSnapshot) : 1,
      jumlahBarang: Math.round(jumlahBarang),
      hargaSatuan: Math.round(hargaSatuan),
    });
  }

  const { tahun, mingguKe } = parsedWeek;
  const { start } = weekRange(tahun, mingguKe);

  const existing = await findExistingPermintaan(unitId, tahun, mingguKe);
  if (existing && existing.id !== id) {
    // Sesuai keputusan desain: 1 unit hanya 1 submission per minggu.
    // Tambah baru: arahkan ke permintaan yang sudah ada (replace).
    // Edit pindah unit/minggu: tolak supaya tidak bentrok dengan data lain.
    if (!id) redirect(`/permintaan/${existing.id}`);
    return { error: "Unit ini sudah punya permintaan di minggu tersebut. Pilih minggu lain atau edit permintaan itu." };
  }

  const header = await savePermintaanMingguan({
    id,
    unitId,
    tanggal: start,
    tahun,
    mingguKe,
    items,
  });

  redirect(`/permintaan/${header.id}?saved=1`);
}

export async function deletePermintaanAction(id: string) {
  await requireSession();
  await deletePermintaanMingguan(id);
  redirect("/permintaan");
}

export type BatchFormInput = { unitId: string; minggu: string; items: PermintaanItemInput[] };
export type BatchSaveResult =
  | { ok: true; saved: { unitId: string; minggu: string; id: string; appended: boolean; itemCount: number }[] }
  | { ok: false; error: string };

// Simpan hasil scan batch: tiap formulir -> permintaan unit pada minggunya.
// Formulir dengan unit + minggu sama dalam satu batch digabung jadi satu.
export async function saveBatchPermintaanAction(forms: BatchFormInput[]): Promise<BatchSaveResult> {
  await requireSession();

  if (!Array.isArray(forms) || forms.length === 0) return { ok: false, error: "Tidak ada formulir untuk disimpan." };

  const merged = new Map<string, BatchFormInput & { tahun: number; mingguKe: number }>();
  for (const [index, form] of forms.entries()) {
    const label = `Formulir #${index + 1}`;
    if (!form?.unitId) return { ok: false, error: `${label}: unit belum dipilih.` };
    const week = parseMingguValue(String(form.minggu ?? ""));
    if (!week) return { ok: false, error: `${label}: minggu belum diisi.` };
    if (!Array.isArray(form.items) || form.items.length === 0) {
      return { ok: false, error: `${label}: belum ada barang.` };
    }

    const items: PermintaanItemInput[] = [];
    for (const it of form.items) {
      const jumlahBarang = Math.round(Number(it?.jumlahBarang));
      const hargaSatuan = Math.round(Number(it?.hargaSatuan));
      const isiSnapshot = Math.round(Number(it?.isiSnapshot ?? 1));
      if (!it?.barangId || !it.namaBarangSnapshot) return { ok: false, error: `${label}: ada baris yang barangnya belum dipilih.` };
      if (!Number.isFinite(jumlahBarang) || jumlahBarang <= 0) return { ok: false, error: `${label}: jumlah harus lebih dari 0.` };
      if (!Number.isFinite(hargaSatuan) || hargaSatuan < 0) return { ok: false, error: `${label}: harga satuan tidak valid.` };
      items.push({
        barangId: it.barangId,
        namaBarangSnapshot: it.namaBarangSnapshot,
        satuanSnapshot: String(it.satuanSnapshot ?? ""),
        isiSnapshot: Number.isFinite(isiSnapshot) && isiSnapshot >= 1 ? isiSnapshot : 1,
        jumlahBarang,
        hargaSatuan,
      });
    }

    const key = `${form.unitId}|${week.tahun}|${week.mingguKe}`;
    const existing = merged.get(key);
    if (existing) existing.items.push(...items);
    else merged.set(key, { unitId: form.unitId, minggu: form.minggu, items, ...week });
  }

  const saved: Extract<BatchSaveResult, { ok: true }>["saved"] = [];
  for (const form of merged.values()) {
    const result = await appendOrCreatePermintaan({
      unitId: form.unitId,
      tanggal: weekRange(form.tahun, form.mingguKe).start,
      tahun: form.tahun,
      mingguKe: form.mingguKe,
      items: form.items,
    });
    saved.push({ unitId: form.unitId, minggu: form.minggu, id: result.id, appended: result.appended, itemCount: form.items.length });
  }

  revalidatePath("/permintaan");
  return { ok: true, saved };
}
