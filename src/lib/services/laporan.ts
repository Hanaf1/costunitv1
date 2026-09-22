import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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
  permintaanMingguanId: string;
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

function buildItemWhere(filters: LaporanFilters): Prisma.PermintaanItemWhereInput {
  const itemWhere: Prisma.PermintaanItemWhereInput = {
    permintaanMingguan: buildHeaderWhere(filters),
  };
  if (filters.barangIds.length > 0) {
    itemWhere.barangId = { in: filters.barangIds };
  }
  if (filters.satuan.length > 0) {
    itemWhere.satuanSnapshot = { in: filters.satuan };
  }
  return itemWhere;
}

const detailSelect = {
  id: true,
  permintaanMingguanId: true,
  namaBarangSnapshot: true,
  satuanSnapshot: true,
  jumlahBarang: true,
  hargaSatuan: true,
  harga: true,
  permintaanMingguan: {
    select: { tanggal: true, tahun: true, mingguKe: true, unitId: true, unit: { select: { namaUnit: true } } },
  },
} satisfies Prisma.PermintaanItemSelect;

type DetailItem = Prisma.PermintaanItemGetPayload<{ select: typeof detailSelect }>;

function toDetailRow(item: DetailItem): LaporanDetailRow {
  return {
    id: item.id,
    permintaanMingguanId: item.permintaanMingguanId,
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
  };
}

const detailOrder: Prisma.PermintaanItemOrderByWithRelationInput[] = [
  { permintaanMingguan: { tanggal: "desc" } },
  { createdAt: "desc" },
  { id: "asc" },
];

// Versi halaman web: semua (total, ringkasan, 1 halaman detail) diambil dalam
// SATU query SQL. DB online punya latency per round-trip dan pooler-nya
// mengantre query paralel, jadi jumlah query jauh lebih menentukan daripada
// beratnya query (data kecil, eksekusi di Postgres < 1 ms).
function buildItemSqlWhere(filters: LaporanFilters): Prisma.Sql {
  const conds: Prisma.Sql[] = [];
  if (filters.mode === "minggu" && filters.tahun && filters.mingguKe) {
    conds.push(Prisma.sql`m.tahun = ${filters.tahun} AND m."mingguKe" = ${filters.mingguKe}`);
  } else if (filters.mode === "rentang") {
    if (filters.startDate) conds.push(Prisma.sql`m.tanggal >= ${filters.startDate}`);
    if (filters.endDate) conds.push(Prisma.sql`m.tanggal <= ${filters.endDate}`);
  }
  if (filters.unitIds.length > 0) conds.push(Prisma.sql`m."unitId" IN (${Prisma.join(filters.unitIds)})`);
  if (filters.barangIds.length > 0) conds.push(Prisma.sql`i."barangId" IN (${Prisma.join(filters.barangIds)})`);
  if (filters.satuan.length > 0) conds.push(Prisma.sql`i."satuanSnapshot" IN (${Prisma.join(filters.satuan)})`);
  return conds.length ? Prisma.sql`WHERE ${Prisma.join(conds, " AND ")}` : Prisma.empty;
}

type LaporanPageSqlRow = {
  grand: { totalRows: number; jumlah: number; harga: number };
  by_unit: LaporanSummaryRow[] | null;
  by_item: LaporanSummaryRow[] | null;
  detail: (Omit<LaporanDetailRow, "tanggal"> & { tanggal: string })[] | null;
};

export async function getLaporanPage(filters: LaporanFilters, page: number, pageSize: number) {
  const where = buildItemSqlWhere(filters);
  const offset = (page - 1) * pageSize;

  const [row] = await prisma.$queryRaw<LaporanPageSqlRow[]>`
    WITH f AS (
      SELECT i.id, i."permintaanMingguanId", i."namaBarangSnapshot", i."satuanSnapshot",
             i."jumlahBarang", i."hargaSatuan", i.harga, i."createdAt",
             m.tanggal, m.tahun, m."mingguKe", m."unitId", u."namaUnit"
      FROM "PermintaanItem" i
      JOIN "PermintaanMingguan" m ON m.id = i."permintaanMingguanId"
      JOIN "Unit" u ON u.id = m."unitId"
      ${where}
    )
    SELECT
      (SELECT json_build_object(
         'totalRows', count(*)::int,
         'jumlah', coalesce(sum("jumlahBarang"), 0)::bigint::float8,
         'harga', coalesce(sum(harga), 0)::bigint::float8) FROM f) AS grand,
      (SELECT json_agg(x ORDER BY x."totalHarga" DESC) FROM (
         SELECT "unitId" AS key, min("namaUnit") AS label,
                sum("jumlahBarang")::float8 AS "totalPermintaan", sum(harga)::float8 AS "totalHarga"
         FROM f GROUP BY "unitId") x) AS by_unit,
      (SELECT json_agg(x ORDER BY x."totalHarga" DESC) FROM (
         SELECT "namaBarangSnapshot" || '__' || "satuanSnapshot" AS key,
                "namaBarangSnapshot" || ' (' || "satuanSnapshot" || ')' AS label,
                sum("jumlahBarang")::float8 AS "totalPermintaan", sum(harga)::float8 AS "totalHarga"
         FROM f GROUP BY "namaBarangSnapshot", "satuanSnapshot") x) AS by_item,
      (SELECT json_agg(d) FROM (
         SELECT id, "permintaanMingguanId", tanggal, tahun, "mingguKe", "unitId", "namaUnit",
                "namaBarangSnapshot", "satuanSnapshot", "jumlahBarang", "hargaSatuan", harga
         FROM f ORDER BY tanggal DESC, "createdAt" DESC, id
         LIMIT ${pageSize} OFFSET ${offset}) d) AS detail
  `;

  return {
    detail: (row.detail ?? []).map((d) => ({ ...d, tanggal: new Date(d.tanggal) })),
    totalRows: row.grand.totalRows,
    summaryByUnit: row.by_unit ?? [],
    summaryByItem: row.by_item ?? [],
    grandTotal: { totalPermintaan: row.grand.jumlah, totalHarga: row.grand.harga },
  };
}

export async function getLaporanData(filters: LaporanFilters): Promise<LaporanResult> {
  const itemWhere = buildItemWhere(filters);

  const items = await prisma.permintaanItem.findMany({
    where: itemWhere,
    select: detailSelect,
    orderBy: detailOrder,
    take: 5000,
  });

  const detail = items.map(toDetailRow);

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

export async function describeFilters(
  filters: LaporanFilters,
  lookup?: {
    units: { id: string; namaUnit: string }[];
    barang: { id: string; namaBarang: string }[];
  },
): Promise<string> {
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
    const units = lookup
      ? lookup.units.filter((u) => filters.unitIds.includes(u.id))
      : await prisma.unit.findMany({
          where: { id: { in: filters.unitIds } },
          select: { namaUnit: true },
        });
    parts.push(`Unit: ${units.map((u) => u.namaUnit).join(", ")}`);
  }

  if (filters.barangIds.length > 0) {
    const barang = lookup
      ? lookup.barang.filter((b) => filters.barangIds.includes(b.id))
      : await prisma.barang.findMany({
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

// Opsi filter laporan (minggu, unit, barang, satuan) dalam satu round-trip.
export async function getLaporanLookups() {
  const [row] = await prisma.$queryRaw<
    {
      weeks: { tahun: number; mingguKe: number }[] | null;
      units: { id: string; namaUnit: string }[] | null;
      barang: { id: string; namaBarang: string }[] | null;
      satuan: string[] | null;
    }[]
  >`
    SELECT
      (SELECT json_agg(w ORDER BY w.tahun DESC, w."mingguKe" DESC)
         FROM (SELECT DISTINCT tahun, "mingguKe" FROM "PermintaanMingguan") w) AS weeks,
      (SELECT json_agg(json_build_object('id', id, 'namaUnit', "namaUnit") ORDER BY "namaUnit") FROM "Unit") AS units,
      (SELECT json_agg(json_build_object('id', id, 'namaBarang', "namaBarang") ORDER BY "namaBarang") FROM "Barang") AS barang,
      (SELECT json_agg(DISTINCT "satuanDasar" ORDER BY "satuanDasar") FROM "Barang") AS satuan
  `;
  return {
    weeks: row.weeks ?? [],
    units: row.units ?? [],
    barang: row.barang ?? [],
    satuan: row.satuan ?? [],
  };
}
