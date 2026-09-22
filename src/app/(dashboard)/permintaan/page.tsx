import Link from "next/link";
import { Eye, Plus, ScanLine } from "lucide-react";
import { DeletePermintaanButton } from "./delete-button";
import { UsageChart } from "./usage-chart";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listPermintaanMingguan, usagePerItem, type PermintaanListFilter } from "@/lib/services/permintaan";
import { weekLabel } from "@/lib/week";
import { formatNumber, formatRupiah } from "@/lib/format";
import { PageHeader } from "../page-header";
import { buttonPrimary, buttonSecondary, card, input } from "@/lib/ui";

export default async function PermintaanListPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string; minggu?: string }>;
}) {
  await requireSession();
  const sp = await searchParams;

  const filter: PermintaanListFilter = {};
  if (sp.unit) filter.unitId = sp.unit;
  const week = /^(\d{4})-W(\d{2})$/.exec(sp.minggu ?? "");
  if (week) {
    filter.tahun = Number(week[1]);
    filter.mingguKe = Number(week[2]);
  }

  const [list, usage, units] = await Promise.all([
    listPermintaanMingguan(filter),
    usagePerItem(filter),
    prisma.unit.findMany({ select: { id: true, namaUnit: true }, orderBy: { namaUnit: "asc" } }),
  ]);

  const unitName = units.find((u) => u.id === filter.unitId)?.namaUnit;
  const scope = [
    unitName ?? "Semua unit",
    filter.tahun && filter.mingguKe ? weekLabel(filter.tahun, filter.mingguKe) : "semua minggu",
  ].join(" · ");
  const isFiltered = Boolean(filter.unitId || filter.mingguKe);

  const totalHpp = list.reduce((sum, p) => sum + p.totalHpp, 0);
  const perUnit = new Map<string, { nama: string; satuan: string; jumlah: number; harga: number }>();
  for (const p of list) {
    const cur = perUnit.get(p.unitId) ?? { nama: p.unit.namaUnit, satuan: "", jumlah: 0, harga: 0 };
    cur.harga += p.totalHpp;
    perUnit.set(p.unitId, cur);
  }
  const unitUsage = [...perUnit.values()].sort((a, b) => b.harga - a.harga);
  const stats = [
    { label: "Total HPP", value: formatRupiah(totalHpp) },
    { label: "Submission", value: formatNumber(list.length) },
    { label: "Unit terlibat", value: formatNumber(perUnit.size) },
    { label: "Jenis barang", value: formatNumber(usage.length) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Permintaan Mingguan"
        description={`${list.length} submission${isFiltered ? " sesuai filter" : " tercatat (terbaru di atas)"}.`}
        action={
          <div className="flex gap-2">
            <Link href="/permintaan/scan-batch" className={buttonSecondary}>
              <ScanLine size={16} />
              Scan Batch
            </Link>
            <Link href="/permintaan/baru" className={buttonPrimary}>
              <Plus size={16} />
              Permintaan Baru
            </Link>
          </div>
        }
      />

      <form method="get" className={`flex flex-wrap items-end gap-3 p-4 ${card}`}>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Unit</span>
          <select name="unit" defaultValue={filter.unitId ?? ""} className={`${input} w-60`}>
            <option value="">Semua unit</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.namaUnit}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Minggu</span>
          <input type="week" name="minggu" defaultValue={week ? sp.minggu : ""} className={`${input} w-48`} />
        </label>
        <button type="submit" className={buttonPrimary}>
          Terapkan
        </button>
        {isFiltered && (
          <Link href="/permintaan" className={buttonSecondary}>
            Reset
          </Link>
        )}
      </form>

      <dl className={`grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-100 ${card}`}>
        {stats.map((st) => (
          <div key={st.label} className="px-5 py-4">
            <dt className="text-xs font-medium text-slate-500">{st.label}</dt>
            <dd className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">{st.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
        <UsageChart title="Penggunaan per Barang" data={usage} subtitle={scope} />
        <UsageChart title="Biaya per Unit" data={unitUsage} subtitle={scope} />
      </div>

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
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  {isFiltered ? "Tidak ada permintaan untuk filter ini." : "Belum ada permintaan mingguan yang diinput."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
