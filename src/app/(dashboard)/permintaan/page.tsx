import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { DeletePermintaanButton } from "./delete-button";
import { requireSession } from "@/lib/auth";
import { listPermintaanMingguan } from "@/lib/services/permintaan";
import { weekLabel } from "@/lib/week";
import { formatRupiah } from "@/lib/format";
import { PageHeader } from "../page-header";
import { buttonPrimary, card } from "@/lib/ui";

export default async function PermintaanListPage() {
  await requireSession();
  const list = await listPermintaanMingguan();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Permintaan Mingguan"
        description={`${list.length} submission tercatat (terbaru di atas).`}
        action={
          <Link href="/permintaan/baru" className={buttonPrimary}>
            <Plus size={16} />
            Permintaan Baru
          </Link>
        }
      />

      <div className={`overflow-x-auto ${card}`}>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Unit</th>
              <th className="px-4 py-2.5 font-medium">Minggu</th>
              <th className="px-4 py-2.5 font-medium text-right">Jumlah Item</th>
              <th className="px-4 py-2.5 font-medium text-right">Total HPP</th>
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-4 py-2.5 font-medium text-slate-900">{p.unit.namaUnit}</td>
                <td className="px-4 py-2.5 text-slate-600">{weekLabel(p.tahun, p.mingguKe)}</td>
                <td className="px-4 py-2.5 text-right text-slate-600">{p._count.items}</td>
                <td className="px-4 py-2.5 text-right text-slate-900 font-medium">{formatRupiah(p.totalHpp)}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/permintaan/${p.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    >
                      <Eye size={14} />
                      Lihat Detail
                    </Link>
                    <DeletePermintaanButton
                      id={p.id}
                      description={`${p.unit.namaUnit} - ${weekLabel(p.tahun, p.mingguKe)}`}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  Belum ada permintaan mingguan yang diinput.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
