import { formatNumber, formatRupiah } from "@/lib/format";
import { card } from "@/lib/ui";

type Usage = { nama: string; satuan: string; jumlah: number; harga: number };

const MAX_BARS = 15;

// Bar horizontal satu seri: total harga pemakaian per barang, urut terbesar.
// Sisa di luar MAX_BARS digabung jadi "Lainnya" supaya chart tetap terbaca.
export function UsageChart({ title, data, subtitle }: { title: string; data: Usage[]; subtitle: string }) {
  const top = data.slice(0, MAX_BARS);
  const rest = data.slice(MAX_BARS);
  const bars = rest.length
    ? [
        ...top,
        {
          nama: `Lainnya (${rest.length})`,
          satuan: "",
          jumlah: 0,
          harga: rest.reduce((s, r) => s + r.harga, 0),
        },
      ]
    : top;
  const max = Math.max(1, ...bars.map((b) => b.harga));
  const total = data.reduce((s, r) => s + r.harga, 0);

  return (
    <section className={`p-5 ${card}`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <p className="text-sm text-slate-600">
          Total <span className="font-semibold text-slate-900 tabular-nums">{formatRupiah(total)}</span>
        </p>
      </div>

      {bars.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Belum ada data pemakaian untuk filter ini.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {bars.map((b) => {
            const pct = (b.harga / max) * 100;
            const share = total ? (b.harga / total) * 100 : 0;
            const qty = b.satuan ? `${formatNumber(b.jumlah)} ${b.satuan}` : "";
            return (
              <li
                key={`${b.nama}|${b.satuan}`}
                className="group relative grid grid-cols-[minmax(8rem,14rem)_1fr_auto] items-center gap-3 rounded px-1 py-1 hover:bg-slate-50"
              >
                <span className="truncate text-sm text-slate-700" title={b.nama}>
                  {b.nama}
                </span>
                <span className="h-3.5">
                  <span
                    className="block h-full rounded-r bg-slate-700 group-hover:bg-slate-900"
                    style={{ width: `max(${pct}%, 2px)` }}
                  />
                </span>
                <span className="text-right text-sm tabular-nums text-slate-900 whitespace-nowrap">
                  {formatRupiah(b.harga)}
                  {qty && <span className="ml-2 text-xs text-slate-500">{qty}</span>}
                </span>

                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-1/3 bottom-full z-10 mb-1 hidden rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md group-hover:block"
                >
                  <span className="block font-medium text-slate-900">{b.nama}</span>
                  {qty && <span className="block text-slate-600">Jumlah: {qty}</span>}
                  <span className="block text-slate-600">
                    Biaya: {formatRupiah(b.harga)} · {share.toFixed(1)}% dari total
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
