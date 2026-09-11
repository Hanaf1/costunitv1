import { Download } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { describeFilters, getLaporanData, listAvailableSatuan, listAvailableWeeks } from "@/lib/services/laporan";
import { parseLaporanSearchParams, type LaporanSearchParams } from "@/lib/services/laporanFilters";
import { weekLabel } from "@/lib/week";
import { formatNumber, formatRupiah } from "@/lib/format";
import { LaporanFilterForm } from "./filter-form";
import { PageHeader } from "../page-header";
import { buttonSuccess, card } from "@/lib/ui";

const DETAIL_PREVIEW_LIMIT = 200;

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<LaporanSearchParams>;
}) {
  await requireSession();
  const sp = await searchParams;
  const filters = parseLaporanSearchParams(sp);

  const [weeks, units, barang, satuanOptions, result, filterLabel] = await Promise.all([
    listAvailableWeeks(),
    prisma.unit.findMany({ orderBy: { namaUnit: "asc" } }),
    prisma.barang.findMany({ orderBy: { namaBarang: "asc" } }),
    listAvailableSatuan(),
    getLaporanData(filters),
    describeFilters(filters),
  ]);

  const exportParams = new URLSearchParams();
  exportParams.set("mode", filters.mode);
  if (filters.mode === "minggu" && filters.tahun && filters.mingguKe) {
    exportParams.set("minggu", `${filters.tahun}-${filters.mingguKe}`);
  }
  if (filters.startDate) exportParams.set("start", sp.start ?? "");
  if (filters.endDate) exportParams.set("end", sp.end ?? "");
  filters.unitIds.forEach((id) => exportParams.append("unit", id));
  filters.barangIds.forEach((id) => exportParams.append("barang", id));
  filters.satuan.forEach((s) => exportParams.append("satuan", s));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Laporan Cost Unit" description={`Filter: ${filterLabel}`} />

      <LaporanFilterForm
        mode={filters.mode}
        minggu={filters.tahun && filters.mingguKe ? `${filters.tahun}-${filters.mingguKe}` : ""}
        start={sp.start ?? ""}
        end={sp.end ?? ""}
        weekOptions={weeks.map((w) => ({
          value: `${w.tahun}-${w.mingguKe}`,
          label: weekLabel(w.tahun, w.mingguKe),
        }))}
        unitOptions={units.map((u) => ({ value: u.id, label: u.namaUnit }))}
        selectedUnits={filters.unitIds}
        barangOptions={barang.map((b) => ({ value: b.id, label: b.namaBarang }))}
        selectedBarang={filters.barangIds}
        satuanOptions={satuanOptions}
        selectedSatuan={filters.satuan}
      />

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-4">
          <StatCard label="Total Permintaan" value={formatNumber(result.grandTotal.totalPermintaan)} />
          <StatCard label="Total Harga" value={formatRupiah(result.grandTotal.totalHarga)} accent />
        </div>
        <a href={`/api/laporan/export?${exportParams.toString()}`} className={buttonSuccess}>
          <Download size={16} />
          Export Excel
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SummaryTable title="Ringkasan per Unit" rows={result.summaryByUnit} />
        <SummaryTable title="Ringkasan per Item" rows={result.summaryByItem} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-2">
          Detail Permintaan {result.detail.length > DETAIL_PREVIEW_LIMIT && `(preview ${DETAIL_PREVIEW_LIMIT} dari ${result.detail.length} baris)`}
        </h2>
        <div className={`overflow-x-auto ${card}`}>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">Tanggal</th>
                <th className="px-4 py-2.5 font-medium">Minggu</th>
                <th className="px-4 py-2.5 font-medium">Unit</th>
                <th className="px-4 py-2.5 font-medium">Nama Barang</th>
                <th className="px-4 py-2.5 font-medium">Satuan</th>
                <th className="px-4 py-2.5 font-medium text-right">Jumlah</th>
                <th className="px-4 py-2.5 font-medium text-right">Harga Satuan</th>
                <th className="px-4 py-2.5 font-medium text-right">Harga</th>
              </tr>
            </thead>
            <tbody>
              {result.detail.slice(0, DETAIL_PREVIEW_LIMIT).map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 text-slate-600">
                    {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(row.tanggal)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {row.mingguKe}/{row.tahun}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{row.namaUnit}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{row.namaBarangSnapshot}</td>
                  <td className="px-4 py-2.5 text-slate-600">{row.satuanSnapshot}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{formatNumber(row.jumlahBarang)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{formatRupiah(row.hargaSatuan)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-900 font-medium">{formatRupiah(row.harga)}</td>
                </tr>
              ))}
              {result.detail.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    Tidak ada data untuk filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`${card} px-4 py-3 min-w-[160px]`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 ${accent ? "text-emerald-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function SummaryTable({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; totalPermintaan: number; totalHarga: number }[];
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900 mb-2">{title}</h2>
      <div className={`overflow-x-auto max-h-96 overflow-y-auto ${card}`}>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left sticky top-0">
            <tr>
              <th className="px-4 py-2.5 font-medium">Nama</th>
              <th className="px-4 py-2.5 font-medium text-right">Total Permintaan</th>
              <th className="px-4 py-2.5 font-medium text-right">Total Harga</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-4 py-2.5 text-slate-900">{row.label}</td>
                <td className="px-4 py-2.5 text-right text-slate-600">{formatNumber(row.totalPermintaan)}</td>
                <td className="px-4 py-2.5 text-right text-slate-900 font-medium">{formatRupiah(row.totalHarga)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-slate-400">
                  Tidak ada data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
