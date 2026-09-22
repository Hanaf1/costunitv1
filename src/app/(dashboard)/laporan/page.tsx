import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Eye } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { describeFilters, getLaporanLookups, getLaporanPage } from "@/lib/services/laporan";
import { parseLaporanSearchParams, type LaporanSearchParams } from "@/lib/services/laporanFilters";
import { weekLabel } from "@/lib/week";
import { formatNumber, formatRupiah } from "@/lib/format";
import { LaporanFilterForm } from "./filter-form";
import { PageHeader } from "../page-header";
import { buttonSecondary, buttonSuccess, card } from "@/lib/ui";

const PAGE_SIZE = 50;

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<LaporanSearchParams & { page?: string }>;
}) {
  await requireSession();
  const sp = await searchParams;
  const filters = parseLaporanSearchParams(sp);
  const requestedPage = Math.max(1, Math.floor(Number(sp.page)) || 1);

  // 2 query total: opsi filter + data laporan (lihat catatan di services/laporan.ts).
  const [{ weeks, units, barang, satuan: satuanOptions }, result] = await Promise.all([
    getLaporanLookups(),
    getLaporanPage(filters, requestedPage, PAGE_SIZE),
  ]);
  // Pakai daftar unit/barang yang sudah dimuat, tanpa query tambahan ke database.
  const filterLabel = await describeFilters(filters, { units, barang });

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

  const totalPages = Math.max(1, Math.ceil(result.totalRows / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const firstRow = result.totalRows === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, result.totalRows);

  function pageHref(target: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (key === "page" || value === undefined) continue;
      (Array.isArray(value) ? value : [value]).forEach((v) => params.append(key, v));
    }
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `/laporan?${qs}` : "/laporan";
  }

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
        <div className="flex gap-2 flex-wrap">
          <a href={`/api/laporan/export?${exportParams.toString()}`} className={buttonSuccess}>
            <Download size={16} />
            Export Excel
          </a>
          <a href={`/api/laporan/export?${exportParams.toString()}&format=rincian-unit`} className={buttonSecondary}>
            <Download size={16} />
            Export Format Rincian per Unit
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SummaryTable title="Ringkasan per Unit" rows={result.summaryByUnit} />
        <SummaryTable title="Ringkasan per Item" rows={result.summaryByItem} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-2">
          Detail Permintaan{" "}
          <span className="font-normal text-slate-500">
            ({formatNumber(firstRow)}–{formatNumber(lastRow)} dari {formatNumber(result.totalRows)} baris)
          </span>
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
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {result.detail.map((row) => (
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
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/permintaan/${row.permintaanMingguanId}`}
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    >
                      <Eye size={14} />
                      Lihat
                    </Link>
                  </td>
                </tr>
              ))}
              {result.detail.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    Tidak ada data untuk filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <nav className="mt-3 flex items-center justify-between gap-3 text-sm" aria-label="Halaman detail">
            <span className="text-slate-600">
              Halaman {page} dari {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <PageLink href={pageHref(page - 1)} disabled={page <= 1} label="Sebelumnya">
                <ChevronLeft size={16} />
              </PageLink>
              {pageNumbers(page, totalPages).map((n, i) =>
                n === null ? (
                  <span key={`gap-${i}`} className="px-2 text-slate-400">
                    …
                  </span>
                ) : (
                  <Link
                    key={n}
                    href={pageHref(n)}
                    aria-current={n === page ? "page" : undefined}
                    className={`min-w-9 rounded-md px-2.5 py-1.5 text-center tabular-nums ${
                      n === page ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {n}
                  </Link>
                ),
              )}
              <PageLink href={pageHref(page + 1)} disabled={page >= totalPages} label="Berikutnya">
                <ChevronRight size={16} />
              </PageLink>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}

// 1 … 4 5 [6] 7 8 … 20
function pageNumbers(current: number, total: number): (number | null)[] {
  const set = new Set([1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const cls = "flex h-8 w-8 items-center justify-center rounded-md border border-slate-200";
  if (disabled) {
    return (
      <span aria-disabled className={`${cls} text-slate-300`}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={`${cls} bg-white text-slate-700 hover:bg-slate-50`}>
      {children}
    </Link>
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
