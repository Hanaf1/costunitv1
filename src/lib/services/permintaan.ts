import { prisma } from "@/lib/prisma";

export type PermintaanItemInput = {
  barangId: string;
  namaBarangSnapshot: string;
  satuanSnapshot: string;
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

export async function listPermintaanMingguan() {
  return prisma.permintaanMingguan.findMany({
    include: { unit: true, _count: { select: { items: true } } },
    orderBy: [{ tahun: "desc" }, { mingguKe: "desc" }, { unit: { namaUnit: "asc" } }],
    take: 200,
  });
}

export async function deletePermintaanMingguan(id: string) {
  await prisma.permintaanMingguan.delete({ where: { id } });
}
