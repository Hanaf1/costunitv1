import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/format";
import { EditBarangForm } from "./edit-form";
import { PageHeader } from "../../../page-header";
import { card } from "@/lib/ui";

export default async function EditBarangPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  const barang = await prisma.barang.findUnique({
    where: { id },
    include: { riwayatHarga: { orderBy: { createdAt: "desc" }, take: 20 } },
  });

  if (!barang) notFound();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Edit Barang" description={barang.namaBarang} />

      <EditBarangForm barang={barang} />

      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-2">Riwayat Perubahan Harga</h2>
        {barang.riwayatHarga.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada perubahan harga tercatat.</p>
        ) : (
          <div className={`overflow-x-auto ${card}`}>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Tanggal</th>
                  <th className="px-4 py-2.5 font-medium">Sumber</th>
                  <th className="px-4 py-2.5 font-medium text-right">Harga Lama</th>
                  <th className="px-4 py-2.5 font-medium text-right">Harga Baru</th>
                  <th className="px-4 py-2.5 font-medium">Diubah Oleh</th>
                </tr>
              </thead>
              <tbody>
                {barang.riwayatHarga.map((h) => (
                  <tr key={h.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 text-slate-600">
                      {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(
                        h.createdAt,
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{h.sumberPerubahan}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{formatRupiah(h.hargaLama)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-900 font-medium">{formatRupiah(h.hargaBaru)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{h.diubahOleh ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
