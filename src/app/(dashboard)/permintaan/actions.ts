"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { weekRange } from "@/lib/week";
import {
  findExistingPermintaan,
  savePermintaanMingguan,
  deletePermintaanMingguan,
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
      jumlahBarang: Math.round(jumlahBarang),
      hargaSatuan: Math.round(hargaSatuan),
    });
  }

  const { tahun, mingguKe } = parsedWeek;
  const { start } = weekRange(tahun, mingguKe);

  if (!id) {
    const existing = await findExistingPermintaan(unitId, tahun, mingguKe);
    if (existing) {
      // Sesuai keputusan desain: 1 unit hanya 1 submission per minggu.
      // Kalau sudah ada, arahkan ke halaman edit yang sudah ada (replace).
      redirect(`/permintaan/${existing.id}`);
    }
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
