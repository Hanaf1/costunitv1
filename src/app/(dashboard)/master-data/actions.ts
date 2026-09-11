"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { parseMasterBarangWorkbook, parseMasterUnitWorkbook } from "@/lib/excel/masterData";
import { updateBarangManual, upsertBarangFromImport, upsertUnitsFromImport } from "@/lib/services/masterData";

export type ImportState =
  | { ok: true; message: string; warnings: string[] }
  | { ok: false; message: string }
  | undefined;

export async function importUnitAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await requireSession();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { ok: false, message: "Pilih file master-unit .xlsx terlebih dahulu." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows, errors } = await parseMasterUnitWorkbook(buffer);

  if (rows.length === 0) {
    return { ok: false, message: errors[0] ?? "Tidak ada baris valid ditemukan di file." };
  }

  const result = await upsertUnitsFromImport(rows);
  revalidatePath("/master-data/unit");

  return {
    ok: true,
    message: `Berhasil: ${result.created} unit baru, ${result.updated} unit diperbarui.`,
    warnings: errors,
  };
}

export async function importBarangAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await requireSession();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { ok: false, message: "Pilih file master-barang .xlsx terlebih dahulu." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows, errors } = await parseMasterBarangWorkbook(buffer);

  if (rows.length === 0) {
    return { ok: false, message: errors[0] ?? "Tidak ada baris valid ditemukan di file." };
  }

  const result = await upsertBarangFromImport(rows);
  revalidatePath("/master-data/barang");

  return {
    ok: true,
    message: `Berhasil: ${result.created} barang baru, ${result.updated} diperbarui, ${result.hargaChanged} harga berubah (tercatat di riwayat).`,
    warnings: errors,
  };
}

export type EditBarangState = { error?: string } | undefined;

export async function updateBarangAction(_prev: EditBarangState, formData: FormData): Promise<EditBarangState> {
  const username = await requireSession();

  const id = String(formData.get("id") ?? "");
  const namaBarang = String(formData.get("namaBarang") ?? "").trim();
  const satuanDasar = String(formData.get("satuanDasar") ?? "").trim();
  const hargaReferensiRaw = String(formData.get("hargaReferensi") ?? "");
  const hargaReferensi = Number(hargaReferensiRaw.replace(/[^0-9-]/g, ""));

  if (!id || !namaBarang || !satuanDasar || !Number.isFinite(hargaReferensi)) {
    return { error: "Nama barang, satuan dasar, dan harga referensi wajib diisi dengan benar." };
  }

  await updateBarangManual(
    id,
    {
      namaBarang,
      kategori: String(formData.get("kategori") ?? "").trim() || null,
      subKategori: String(formData.get("subKategori") ?? "").trim() || null,
      jenisItem: String(formData.get("jenisItem") ?? "").trim() || null,
      tipeBarang: String(formData.get("tipeBarang") ?? "").trim() || null,
      satuanDasar,
      satuanKonversi: String(formData.get("satuanKonversi") ?? "").trim() || null,
      hargaReferensi: Math.round(hargaReferensi),
      status: String(formData.get("status") ?? "Aktif"),
    },
    username,
  );

  revalidatePath("/master-data/barang");
  revalidatePath(`/master-data/barang/${id}`);

  return undefined;
}
