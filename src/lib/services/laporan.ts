import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type LaporanFilters = {
  mode: "minggu" | "rentang";
  tahun?: number;
  mingguKe?: number;
  startDate?: Date;
  endDate?: Date;
  unitIds: string[];
  barangIds: string[];
  satuan: string[];
};

export type LaporanDetailRow = {
  id: string;
  tanggal: Date;
  tahun: number;
  mingguKe: number;
  unitId: string;
  namaUnit: string;
  namaBarangSnapshot: string;
  satuanSnapshot: string;
  jumlahBarang: number;
  hargaSatuan: number;
  harga: number;
};

export type LaporanSummaryRow = {
  key: string;
  label: string;
  totalPermintaan: number;
  totalHarga: number;
};

export type LaporanResult = {
  detail: LaporanDetailRow[];
  summaryByUnit: LaporanSummaryRow[];
  summaryByItem: LaporanSummaryRow[];
  grandTotal: { totalPermintaan: number; totalHarga: number };
};

function buildHeaderWhere(filters: LaporanFilters): Prisma.PermintaanMingguanWhereInput {
  const where: Prisma.PermintaanMingguanWhereInput = {};

  if (filters.mode === "minggu" && filters.tahun && filters.mingguKe) {
    where.tahun = filters.tahun;
    where.mingguKe = filters.mingguKe;
  } else if (filters.mode === "rentang" && (filters.startDate || filters.endDate)) {
    where.tanggal = {
      ...(filters.startDate ? { gte: filters.startDate } : {}),
      ...(filters.endDate ? { lte: filters.endDate } : {}),
    };
  }

  if (filters.unitIds.length > 0) {
    where.unitId = { in: filters.unitIds };
  }

  return where;
}

export async function getLaporanData(filters: LaporanFilters): Promise<LaporanResult> {
  const headerWhere = buildHeaderWhere(filters);

  const itemWhere: Prisma.PermintaanItemWhereInput = {
    permintaanMingguan: headerWhere,
  };

  if (filters.barangIds.length > 0) {
    itemWhere.barangId = { in: filters.barangIds };
  }
  if (filters.satuan.length > 0) {
    itemWhere.satuanSnapshot = { in: filters.satuan };
  }

  const items = await prisma.permintaanItem.findMany({
    where: itemWhere,
    include: {
      permintaanMingguan: { include: { unit: true } },
    },
    orderBy: { permintaanMingguan: { tanggal: "desc" } },
    take: 5000,
  });

  const detail: LaporanDetailRow[] = items.map((item) => ({
    id: item.id,
    tanggal: item.permintaanMingguan.tanggal,
    tahun: item.permintaanMingguan.tahun,
    mingguKe: item.permintaanMingguan.mingguKe,
    unitId: item.permintaanMingguan.unitId,
    namaUnit: item.permintaanMingguan.unit.namaUnit,
    namaBarangSnapshot: item.namaBarangSnapshot,
    satuanSnapshot: item.satuanSnapshot,
    jumlahBarang: item.jumlahBarang,
    hargaSatuan: item.hargaSatuan,
    harga: item.harga,
  }));

  const byUnit = new Map<string, LaporanSummaryRow>();
  const byItem = new Map<string, LaporanSummaryRow>();
  let grandJumlah = 0;
  let grandHarga = 0;

  for (const row of detail) {
    grandJumlah += row.jumlahBarang;
    grandHarga += row.harga;

    const unitEntry = byUnit.get(row.unitId) ?? {
      key: row.unitId,
      label: row.namaUnit,
      totalPermintaan: 0,
      totalHarga: 0,
    };
    unitEntry.totalPermintaan += row.jumlahBarang;
    unitEntry.totalHarga += row.harga;
    byUnit.set(row.unitId, unitEntry);

    const itemKey = `${row.namaBarangSnapshot}__${row.satuanSnapshot}`;
    const itemEntry = byItem.get(itemKey) ?? {
      key: itemKey,
      label: `${row.namaBarangSnapshot} (${row.satuanSnapshot})`,
      totalPermintaan: 0,
      totalHarga: 0,
    };
    itemEntry.totalPermintaan += row.jumlahBarang;
    itemEntry.totalHarga += row.harga;
    byItem.set(itemKey, itemEntry);
  }

  return {
    detail,
    summaryByUnit: [...byUnit.values()].sort((a, b) => b.totalHarga - a.totalHarga),
    summaryByItem: [...byItem.values()].sort((a, b) => b.totalHarga - a.totalHarga),
    grandTotal: { totalPermintaan: grandJumlah, totalHarga: grandHarga },
  };
}

export async function listAvailableWeeks() {
  const rows = await prisma.permintaanMingguan.findMany({
    distinct: ["tahun", "mingguKe"],
    select: { tahun: true, mingguKe: true },
    orderBy: [{ tahun: "desc" }, { mingguKe: "desc" }],
  });
  return rows;
}

export async function describeFilters(filters: LaporanFilters): Promise<string> {
  const parts: string[] = [];

  if (filters.mode === "minggu" && filters.tahun && filters.mingguKe) {
    parts.push(`Minggu ${filters.mingguKe}/${filters.tahun}`);
  } else if (filters.startDate || filters.endDate) {
    const startLabel = filters.startDate ? filters.startDate.toLocaleDateString("id-ID") : "...";
    const endLabel = filters.endDate ? filters.endDate.toLocaleDateString("id-ID") : "...";
    parts.push(`Tanggal ${startLabel} - ${endLabel}`);
  } else {
    parts.push("Semua periode");
  }

  if (filters.unitIds.length > 0) {
    const units = await prisma.unit.findMany({
      where: { id: { in: filters.unitIds } },
      select: { namaUnit: true },
    });
    parts.push(`Unit: ${units.map((u) => u.namaUnit).join(", ")}`);
  }

  if (filters.barangIds.length > 0) {
    const barang = await prisma.barang.findMany({
      where: { id: { in: filters.barangIds } },
      select: { namaBarang: true },
    });
    parts.push(`Item: ${barang.map((b) => b.namaBarang).join(", ")}`);
  }

  if (filters.satuan.length > 0) {
    parts.push(`Satuan: ${filters.satuan.join(", ")}`);
  }

  return parts.join(" | ");
}

export async function listAvailableSatuan() {
  const rows = await prisma.barang.findMany({
    distinct: ["satuanDasar"],
    select: { satuanDasar: true },
    orderBy: { satuanDasar: "asc" },
  });
  return rows.map((r) => r.satuanDasar);
}
