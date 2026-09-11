import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPermintaanForEdit } from "@/lib/services/permintaan";
import { PermintaanForm } from "../permintaan-form";
import { deletePermintaanAction } from "../actions";
import { PageHeader } from "../../page-header";
import { buttonDanger } from "@/lib/ui";

export default async function EditPermintaanPage({
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
    prisma.unit.findMany({ where: { status: "Aktif" }, orderBy: { namaUnit: "asc" } }),
    prisma.barang.findMany({ where: { status: "Aktif" }, orderBy: { namaBarang: "asc" } }),
  ]);

  if (!permintaan) notFound();

  const mingguValue = `${permintaan.tahun}-W${String(permintaan.mingguKe).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Edit Permintaan Mingguan"
        description={permintaan.unit.namaUnit}
        action={
          <form action={deletePermintaanAction.bind(null, permintaan.id)}>
            <button type="submit" className={buttonDanger}>
              Hapus Permintaan Ini
            </button>
          </form>
        }
      />

      {saved && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2 w-fit">
          Permintaan berhasil disimpan.
        </p>
      )}

      <PermintaanForm
        units={units.map((u) => ({ id: u.id, namaUnit: u.namaUnit }))}
        barangOptions={barang.map((b) => ({
          id: b.id,
          kodeItem: b.kodeItem,
          namaBarang: b.namaBarang,
          satuanDasar: b.satuanDasar,
          hargaReferensi: b.hargaReferensi,
        }))}
        initial={{
          id: permintaan.id,
          unitId: permintaan.unitId,
          mingguValue,
          items: permintaan.items.map((item, index) => ({
            key: `existing-${index}`,
            barangId: item.barangId ?? "",
            namaBarangSnapshot: item.namaBarangSnapshot,
            satuanSnapshot: item.satuanSnapshot,
            jumlahBarang: item.jumlahBarang,
            hargaSatuan: item.hargaSatuan,
          })),
        }}
      />
    </div>
  );
}
