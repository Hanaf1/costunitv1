import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPermintaanForEdit } from "@/lib/services/permintaan";
import { weekLabel } from "@/lib/week";
import { PermintaanForm } from "../permintaan-form";
import { PageHeader } from "../../page-header";
import { buttonSecondary } from "@/lib/ui";

export default async function DetailPermintaanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const { saved } = await searchParams;

  const [permintaan, units, barang] = await Promise.all([
    getPermintaanForEdit(id),
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

  if (!permintaan) notFound();

  const mingguValue = `${permintaan.tahun}-W${String(permintaan.mingguKe).padStart(2, "0")}`;

  // Unit nonaktif tetap harus tampil di detail permintaan lamanya.
  const unitOptions = units.map((u) => ({ id: u.id, namaUnit: u.namaUnit }));
  if (!unitOptions.some((u) => u.id === permintaan.unitId)) {
    unitOptions.unshift({ id: permintaan.unit.id, namaUnit: permintaan.unit.namaUnit });
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Detail Permintaan Mingguan"
        description={`${permintaan.unit.namaUnit} — ${weekLabel(permintaan.tahun, permintaan.mingguKe)}`}
        action={
          <Link href="/permintaan" className={buttonSecondary}>
            <ArrowLeft size={16} />
            Kembali
          </Link>
        }
      />

      {saved && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2 w-fit">
          Permintaan berhasil disimpan.
        </p>
      )}

      <PermintaanForm
        key={permintaan.updatedAt.toISOString()}
        units={unitOptions}
        barangOptions={barang.map((b) => ({
          id: b.id,
          kodeItem: b.kodeItem,
          namaBarang: b.namaBarang,
          satuanDasar: b.satuanDasar,
          hargaReferensi: b.hargaReferensi,
          satuanList: b.satuanList,
        }))}
        initial={{
          id: permintaan.id,
          unitId: permintaan.unitId,
          unitLabel: permintaan.unit.namaUnit,
          mingguValue,
          items: permintaan.items.map((item, index) => ({
            key: `existing-${index}`,
            barangId: item.barangId ?? "",
            namaBarangSnapshot: item.namaBarangSnapshot,
            satuanSnapshot: item.satuanSnapshot,
            isiSnapshot: item.isiSnapshot,
            jumlahBarang: item.jumlahBarang,
            hargaSatuan: item.hargaSatuan,
          })),
        }}
      />
    </div>
  );
}
