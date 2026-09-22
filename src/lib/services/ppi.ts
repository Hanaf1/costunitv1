import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Barang yang dihitung di menu Perhitungan PPI (Pencegahan & Pengendalian Infeksi).
// Dicocokkan lewat kodeItem master barang; nama dipakai sebagai cadangan untuk
// baris permintaan lama yang barangId-nya kosong.
export const PPI_ITEMS = [
  { kode: "BRG0720260435", nama: "Tisu Besar", singkat: "Tisu Besar", satuan: "Pcs" },
  { kode: "BRG0720260334", nama: "Plastik Hitam 80", singkat: "Hitam 80", satuan: "Pack" },
  { kode: "BRG0720260337", nama: "Plastik Kuning 80", singkat: "Kuning 80", satuan: "Pack" },
] as const;

export type PpiRow = {
  unitId: string;
  namaUnit: string;
  tahun: number;
  mingguKe: number;
  kode: string;
  jumlah: number; // dalam satuan dasar (jumlah × isi satuan)
  harga: number;
};

// Satu query: total per unit × minggu × barang PPI dalam rentang tanggal.
export async function getPpiRows(start: Date, end: Date, unitId?: string): Promise<PpiRow[]> {
  const kodes = PPI_ITEMS.map((i) => i.kode);
  const namas = PPI_ITEMS.map((i) => i.nama.toLowerCase());
  const unitFilter = unitId ? Prisma.sql`AND m."unitId" = ${unitId}` : Prisma.empty;

  return prisma.$queryRaw<PpiRow[]>`
    SELECT m."unitId", u."namaUnit", m.tahun, m."mingguKe",
           coalesce(b."kodeItem", k.kode) AS kode,
           sum(i."jumlahBarang" * i."isiSnapshot")::float8 AS jumlah,
           sum(i.harga)::float8 AS harga
    FROM "PermintaanItem" i
    JOIN "PermintaanMingguan" m ON m.id = i."permintaanMingguanId"
    JOIN "Unit" u ON u.id = m."unitId"
    LEFT JOIN "Barang" b ON b.id = i."barangId"
    LEFT JOIN (SELECT unnest(${kodes}::text[]) AS kode, unnest(${namas}::text[]) AS nama) k
      ON i."barangId" IS NULL AND lower(i."namaBarangSnapshot") = k.nama
    WHERE m.tanggal >= ${start} AND m.tanggal <= ${end}
      AND (b."kodeItem" = ANY(${kodes}::text[]) OR k.kode IS NOT NULL)
      ${unitFilter}
    GROUP BY m."unitId", u."namaUnit", m.tahun, m."mingguKe", coalesce(b."kodeItem", k.kode)
    ORDER BY u."namaUnit", m.tahun, m."mingguKe"
  `;
}
