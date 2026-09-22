import { prisma } from "@/lib/prisma";
import type { ParsedBarangRow, ParsedUnitRow } from "@/lib/excel/masterData";

export async function upsertUnitsFromImport(rows: ParsedUnitRow[]) {
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const existing = await prisma.unit.findUnique({ where: { kodeUnit: row.kodeUnit } });
    await prisma.unit.upsert({
      where: { kodeUnit: row.kodeUnit },
      create: { ...row },
      update: { ...row },
    });
    if (existing) updated++;
    else created++;
  }

  return { created, updated };
}

export async function upsertBarangFromImport(rows: ParsedBarangRow[]) {
  let created = 0;
  let updated = 0;
  let hargaChanged = 0;

  for (const row of rows) {
    const existing = await prisma.barang.findUnique({ where: { kodeItem: row.kodeItem } });

    if (!existing) {
      await prisma.barang.create({ data: { ...row } });
      created++;
      continue;
    }

    await prisma.barang.update({
      where: { kodeItem: row.kodeItem },
      data: { ...row },
    });
    updated++;

    if (existing.hargaReferensi !== row.hargaReferensi) {
      await prisma.barangHargaHistory.create({
        data: {
          barangId: existing.id,
          hargaLama: existing.hargaReferensi,
          hargaBaru: row.hargaReferensi,
          sumberPerubahan: "Import",
          diubahOleh: null,
        },
      });
      hargaChanged++;
    }
  }

  return { created, updated, hargaChanged };
}

// Tambah manual via form. Kode yang sudah terpakai ditolak (bukan di-upsert)
// supaya input manual tidak diam-diam menimpa data hasil import.
export async function createUnitManual(data: ParsedUnitRow) {
  const existing = await prisma.unit.findUnique({ where: { kodeUnit: data.kodeUnit } });
  if (existing) return { error: `Kode Unit "${data.kodeUnit}" sudah terdaftar (${existing.namaUnit}).` };

  await prisma.unit.create({ data });
  return {};
}

export type BarangSatuanInput = { namaSatuan: string; isi: number; harga: number | null };

export async function createBarangManual(data: ParsedBarangRow, satuanList: BarangSatuanInput[] = []) {
  const existing = await prisma.barang.findUnique({ where: { kodeItem: data.kodeItem } });
  if (existing) return { error: `Kode Item "${data.kodeItem}" sudah terdaftar (${existing.namaBarang}).` };

  const barang = await prisma.barang.create({ data: { ...data, satuanList: { create: satuanList } } });
  return { id: barang.id };
}

export async function updateBarangManual(
  barangId: string,
  data: {
    namaBarang: string;
    kategori: string | null;
    subKategori: string | null;
    jenisItem: string | null;
    tipeBarang: string | null;
    satuanDasar: string;
    satuanKonversi: string | null;
    hargaReferensi: number;
    status: string;
  },
  diubahOleh: string,
  satuanList?: BarangSatuanInput[],
) {
  const existing = await prisma.barang.findUniqueOrThrow({ where: { id: barangId } });

  await prisma.$transaction(async (tx) => {
    await tx.barang.update({ where: { id: barangId }, data });
    if (satuanList) {
      await tx.barangSatuan.deleteMany({ where: { barangId } });
      await tx.barangSatuan.createMany({ data: satuanList.map((s) => ({ ...s, barangId })) });
    }
  });

  if (existing.hargaReferensi !== data.hargaReferensi) {
    await prisma.barangHargaHistory.create({
      data: {
        barangId,
        hargaLama: existing.hargaReferensi,
        hargaBaru: data.hargaReferensi,
        sumberPerubahan: "Edit Manual",
        diubahOleh,
      },
    });
  }
}
