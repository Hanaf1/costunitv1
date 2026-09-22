import { addDays, endOfMonth, format, startOfMonth } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPpiRows, PPI_ITEMS } from "@/lib/services/ppi";
import { isoWeekInfo } from "@/lib/week";
import { formatNumber, formatRupiah } from "@/lib/format";
import { PageHeader } from "../page-header";
import { buttonPrimary, card, input } from "@/lib/ui";

type Week = { tahun: number; mingguKe: number; senin: Date };

// Minggu ISO yang hari Seninnya jatuh di bulan terpilih (tanggal header
// permintaan disimpan sebagai Senin minggu itu).
function weeksOfMonth(month: Date): Week[] {
  const weeks: Week[] = [];
  const last = endOfMonth(month);
  let d = startOfMonth(month);
  while (d.getDay() !== 1) d = addDays(d, 1);
  for (; d <= last; d = addDays(d, 7)) weeks.push(isoWeekInfo(d));
  return weeks;
}

const weekKey = (tahun: number, mingguKe: number) => `${tahun}-${mingguKe}`;

export default async function PpiPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; unit?: string }>;
}) {
  await requireSession();
  const sp = await searchParams;

  const bulanMatch = /^(\d{4})-(\d{2})$/.exec(sp.bulan ?? "");
  const month = bulanMatch
    ? new Date(Number(bulanMatch[1]), Number(bulanMatch[2]) - 1, 1)
    : startOfMonth(new Date());
  const weeks = weeksOfMonth(month);
  const unitId = sp.unit || undefined;

  const [rows, units] = await Promise.all([
    getPpiRows(startOfMonth(month), endOfMonth(month), unitId),
    prisma.unit.findMany({ select: { id: true, namaUnit: true }, orderBy: { namaUnit: "asc" } }),
  ]);

  // unit -> "minggu|kode" / "total|kode" -> jumlah
  const byUnit = new Map<string, { nama: string; cells: Map<string, number>; harga: number }>();
  const colTotals = new Map<string, number>();
  const add = (map: Map<string, number>, key: string, v: number) => map.set(key, (map.get(key) ?? 0) + v);
  let grandHarga = 0;
  for (const r of rows) {
    const entry = byUnit.get(r.unitId) ?? { nama: r.namaUnit, cells: new Map<string, number>(), harga: 0 };
    const weekCell = `${weekKey(r.tahun, r.mingguKe)}|${r.kode}`;
    const totalCell = `total|${r.kode}`;
    add(entry.cells, weekCell, r.jumlah);
    add(entry.cells, totalCell, r.jumlah);
    add(colTotals, weekCell, r.jumlah);
    add(colTotals, totalCell, r.jumlah);
    entry.harga += r.harga;
    grandHarga += r.harga;
    byUnit.set(r.unitId, entry);
  }
  const unitRows = [...byUnit.entries()].map(([id, v]) => ({ id, ...v }));

  const groups = [
    ...weeks.map((w) => ({
      key: weekKey(w.tahun, w.mingguKe),
      label: `Minggu ${w.mingguKe}`,
      sub: `mulai ${format(w.senin, "d MMM", { locale: localeId })}`,
    })),
    { key: "total", label: "Total Bulan", sub: format(month, "MMMM yyyy", { locale: localeId }) },
  ];
  const colCount = groups.length * PPI_ITEMS.length + 2;

  const cell = (v: number | undefined) => (v ? formatNumber(v) : <span className="text-slate-300">–</span>);
  const groupBg = (key: string) => (key === "total" ? "bg-slate-100" : "");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Perhitungan PPI"
        description={`Pemakaian ${PPI_ITEMS.map((i) => i.nama).join(", ")} per unit, dipisah per minggu permintaan.`}
      />

      <form method="get" className={`flex flex-wrap items-end gap-3 p-4 ${card}`}>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Bulan</span>
          <input type="month" name="bulan" defaultValue={format(month, "yyyy-MM")} className={`${input} w-44`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Unit</span>
          <select name="unit" defaultValue={unitId ?? ""} className={`${input} w-60`}>
            <option value="">Semua unit</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.namaUnit}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonPrimary}>
          Tampilkan
        </button>
      </form>

      <dl className={`grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-100 ${card}`}>
        {PPI_ITEMS.map((item) => (
          <div key={item.kode} className="px-5 py-4">
            <dt className="text-xs font-medium text-slate-500">{item.nama}</dt>
            <dd className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">
              {formatNumber(colTotals.get(`total|${item.kode}`) ?? 0)}{" "}
              <span className="text-sm font-normal text-slate-500">{item.satuan}</span>
            </dd>
          </div>
        ))}
        <div className="px-5 py-4">
          <dt className="text-xs font-medium text-slate-500">Total Biaya PPI</dt>
          <dd className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">{formatRupiah(grandHarga)}</dd>
        </div>
      </dl>

      <div className={`overflow-x-auto ${card}`}>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th rowSpan={2} className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 text-left align-bottom">
                Unit
              </th>
              {groups.map((g) => (
                <th
                  key={g.key}
                  colSpan={PPI_ITEMS.length}
                  className={`border-l border-slate-200 px-3 pt-2.5 pb-1 text-center ${groupBg(g.key)}`}
                >
                  {g.label}
                  <span className="block text-[10px] font-normal normal-case tracking-normal text-slate-500">
                    {g.sub}
                  </span>
                </th>
              ))}
              <th rowSpan={2} className="border-l border-slate-200 bg-slate-100 px-4 py-2.5 text-right align-bottom">
                Biaya
              </th>
            </tr>
            <tr>
              {groups.flatMap((g) =>
                PPI_ITEMS.map((item, i) => (
                  <th
                    key={`${g.key}|${item.kode}`}
                    title={item.nama}
                    className={`px-3 pb-2 text-right whitespace-nowrap normal-case tracking-normal ${i === 0 ? "border-l border-slate-200" : ""} ${groupBg(g.key)}`}
                  >
                    {item.singkat}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {unitRows.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/60">
                <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-slate-900 whitespace-nowrap">
                  {u.nama}
                </td>
                {groups.flatMap((g) =>
                  PPI_ITEMS.map((item, i) => (
                    <td
                      key={`${g.key}|${item.kode}`}
                      className={`px-3 py-2.5 text-right text-slate-800 ${i === 0 ? "border-l border-slate-100" : ""} ${g.key === "total" ? "bg-slate-50 font-semibold text-slate-900" : ""}`}
                    >
                      {cell(u.cells.get(`${g.key}|${item.kode}`))}
                    </td>
                  )),
                )}
                <td className="border-l border-slate-100 bg-slate-50 px-4 py-2.5 text-right font-medium text-slate-900 whitespace-nowrap">
                  {formatRupiah(u.harga)}
                </td>
              </tr>
            ))}
            {unitRows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center text-slate-500">
                  Belum ada permintaan barang PPI di bulan ini.
                </td>
              </tr>
            )}
          </tbody>
          {unitRows.length > 0 && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
              <tr>
                <td className="sticky left-0 bg-slate-50 px-4 py-3">Total</td>
                {groups.flatMap((g) =>
                  PPI_ITEMS.map((item, i) => (
                    <td
                      key={`${g.key}|${item.kode}`}
                      className={`px-3 py-3 text-right ${i === 0 ? "border-l border-slate-200" : ""} ${groupBg(g.key)}`}
                    >
                      {cell(colTotals.get(`${g.key}|${item.kode}`))}
                    </td>
                  )),
                )}
                <td className="border-l border-slate-200 bg-slate-100 px-4 py-3 text-right whitespace-nowrap">
                  {formatRupiah(grandHarga)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Jumlah dihitung dalam satuan dasar (Tisu Besar: Pcs, Plastik: Pack). Permintaan dengan satuan lain dikonversi
        otomatis sesuai isi satuannya. Minggu dikelompokkan menurut hari Senin minggu permintaan.
      </p>
    </div>
  );
}
