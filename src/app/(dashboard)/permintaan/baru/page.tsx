import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PermintaanForm } from "../permintaan-form";
import { PageHeader } from "../../page-header";

export default async function PermintaanBaruPage() {
  await requireSession();

  const [units, barang] = await Promise.all([
    prisma.unit.findMany({
      where: { status: "Aktif" },
      select: { id: true, namaUnit: true },
      orderBy: { namaUnit: "asc" },
    }),
    prisma.barang.findMany({
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
    }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Permintaan Mingguan Baru"
        description="Pilih unit dan minggu, lalu tambahkan barang yang diminta. Jika unit ini sudah punya permintaan untuk minggu yang sama, kamu akan diarahkan ke data yang sudah ada (replace)."
      />

      <PermintaanForm
        units={units.map((u) => ({ id: u.id, namaUnit: u.namaUnit }))}
        barangOptions={barang.map((b) => ({
          id: b.id,
          kodeItem: b.kodeItem,
          namaBarang: b.namaBarang,
          satuanDasar: b.satuanDasar,
          hargaReferensi: b.hargaReferensi,
          satuanList: b.satuanList,
        }))}
      />
    </div>
  );
}
