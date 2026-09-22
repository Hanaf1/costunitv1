import { prisma } from "@/lib/prisma";

export type PermintaanItemInput = {
  barangId: string;
  namaBarangSnapshot: string;
  satuanSnapshot: string;
  isiSnapshot: number;
  jumlahBarang: number;
  hargaSatuan: number;
};

export async function findExistingPermintaan(unitId: string, tahun: number, mingguKe: number) {
  return prisma.permintaanMingguan.findUnique({
    where: { unitId_tahun_mingguKe: { unitId, tahun, mingguKe } },
  });
}

// Simpan header + baris permintaan dalam satu transaksi. Semua baris lama
// dihapus dan diganti baris baru (replace semantics) - lihat PRD Open
// Questions: 1 unit hanya 1 submission per minggu, edit ulang = replace.
export async function savePermintaanMingguan(input: {
  id?: string;
  unitId: string;
  tanggal: Date;
  tahun: number;
  mingguKe: number;
  items: PermintaanItemInput[];
}) {
  const itemsWithTotal = input.items.map((item) => ({
    ...item,
    harga: Math.round(item.jumlahBarang * item.hargaSatuan),
  }));
  const totalHpp = itemsWithTotal.reduce((sum, item) => sum + item.harga, 0);

  return prisma.$transaction(async (tx) => {
    const header = await tx.permintaanMingguan.upsert({
      where: input.id
        ? { id: input.id }
        : { unitId_tahun_mingguKe: { unitId: input.unitId, tahun: input.tahun, mingguKe: input.mingguKe } },
      create: {
        unitId: input.unitId,
        tanggal: input.tanggal,
        tahun: input.tahun,
        mingguKe: input.mingguKe,
        totalHpp,
      },
      update: {
        unitId: input.unitId,
        tanggal: input.tanggal,
        tahun: input.tahun,
        mingguKe: input.mingguKe,
        totalHpp,
      },
    });

    await tx.permintaanItem.deleteMany({ where: { permintaanMingguanId: header.id } });

    if (itemsWithTotal.length > 0) {
      await tx.permintaanItem.createMany({
        data: itemsWithTotal.map((item) => ({
          permintaanMingguanId: header.id,
          barangId: item.barangId,
          namaBarangSnapshot: item.namaBarangSnapshot,
          satuanSnapshot: item.satuanSnapshot,
          isiSnapshot: item.isiSnapshot,
          jumlahBarang: item.jumlahBarang,
          hargaSatuan: item.hargaSatuan,
          harga: item.harga,
        })),
      });
    }

    return header;
  });
}

export async function getPermintaanForEdit(id: string) {
  return prisma.permintaanMingguan.findUnique({
    where: { id },
    include: { unit: true, items: { orderBy: { createdAt: "asc" } } },
  });
}

export type PermintaanListFilter = { unitId?: string; tahun?: number; mingguKe?: number };

function permintaanWhere(f: PermintaanListFilter) {
  return {
    ...(f.unitId ? { unitId: f.unitId } : {}),
    ...(f.tahun && f.mingguKe ? { tahun: f.tahun, mingguKe: f.mingguKe } : {}),
  };
}

export async function listPermintaanMingguan(filter: PermintaanListFilter = {}) {
  return prisma.permintaanMingguan.findMany({
    where: permintaanWhere(filter),
    include: { unit: true, _count: { select: { items: true } } },
    orderBy: [{ tahun: "desc" }, { mingguKe: "desc" }, { unit: { namaUnit: "asc" } }],
    take: 200,
  });
}

// Rekap pemakaian per barang (+ satuan) untuk chart di halaman permintaan.
export async function usagePerItem(filter: PermintaanListFilter = {}) {
  const rows = await prisma.permintaanItem.groupBy({
    by: ["namaBarangSnapshot", "satuanSnapshot"],
    where: { permintaanMingguan: permintaanWhere(filter) },
    _sum: { jumlahBarang: true, harga: true },
  });
  return rows
    .map((r) => ({
      nama: r.namaBarangSnapshot,
      satuan: r.satuanSnapshot,
      jumlah: r._sum.jumlahBarang ?? 0,
      harga: r._sum.harga ?? 0,
    }))
    .sort((a, b) => b.harga - a.harga);
}

export async function deletePermintaanMingguan(id: string) {
  await prisma.permintaanMingguan.delete({ where: { id } });
}

// Opsi barang aktif (+ satuan alternatif) untuk form permintaan & scan batch.
export async function getBarangOptions() {
  return prisma.barang.findMany({
    where: { status: "Aktif" },
    select: {
      id: true,
      kodeItem: true,
      namaBarang: true,
      satuanDasar: true,
      hargaReferensi: true,
      satuanList: { select: { namaSatuan: true, isi: true, harga: true }, orderBy: { isi: "asc" } },
    },
    orderBy: { namaBarang: "asc" },
  });
}

// Scan batch: kalau unit sudah punya permintaan di minggu itu, item DITAMBAHKAN
// (tidak mengganti isi lama seperti savePermintaanMingguan); kalau belum, dibuat baru.
export async function appendOrCreatePermintaan(input: {
  unitId: string;
  tanggal: Date;
  tahun: number;
  mingguKe: number;
  items: PermintaanItemInput[];
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.permintaanMingguan.findUnique({
      where: { unitId_tahun_mingguKe: { unitId: input.unitId, tahun: input.tahun, mingguKe: input.mingguKe } },
      select: { id: true },
    });
    const header =
      existing ??
      (await tx.permintaanMingguan.create({
        data: { unitId: input.unitId, tanggal: input.tanggal, tahun: input.tahun, mingguKe: input.mingguKe },
        select: { id: true },
      }));

    await tx.permintaanItem.createMany({
      data: input.items.map((item) => ({
        permintaanMingguanId: header.id,
        barangId: item.barangId,
        namaBarangSnapshot: item.namaBarangSnapshot,
        satuanSnapshot: item.satuanSnapshot,
        isiSnapshot: item.isiSnapshot,
        jumlahBarang: item.jumlahBarang,
        hargaSatuan: item.hargaSatuan,
        harga: Math.round(item.jumlahBarang * item.hargaSatuan),
      })),
    });

    const sum = await tx.permintaanItem.aggregate({
      where: { permintaanMingguanId: header.id },
      _sum: { harga: true },
    });
    await tx.permintaanMingguan.update({
      where: { id: header.id },
      data: { totalHpp: sum._sum.harga ?? 0 },
    });

    return { id: header.id, appended: Boolean(existing) };
  });
}
