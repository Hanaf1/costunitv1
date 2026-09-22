import { ReceiptText } from "lucide-react";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-white text-slate-900">
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-slate-900 p-12 text-white">
        <ReceiptText
          aria-hidden
          strokeWidth={0.75}
          className="pointer-events-none absolute -right-24 -bottom-24 h-140 w-140 text-white/7"
        />

        <div className="relative flex items-center gap-2 text-sm font-medium text-slate-300">
          <ReceiptText size={18} />
          Cost Unit Report
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">
            Biaya pemakaian barang per unit.
          </h2>
          <p className="mt-3 text-sm text-slate-400">
            Catat permintaan barang tiap unit, hitung HPP otomatis, dan ekspor laporan rincian ke Excel.
          </p>

          <dl className="mt-10 w-72 divide-y divide-white/10 rounded-md border border-white/10 bg-white/3 text-sm tabular-nums">
            {[
              ["Hvs · 2 Rim", "Rp 110.000"],
              ["Tisu Besar · 3 Pcs", "Rp 27.000"],
              ["Baterai A3 · 4 Pcs", "Rp 60.000"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between px-4 py-2.5 text-slate-300">
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
            <div className="flex justify-between px-4 py-2.5 font-semibold text-white">
              <dt>Total HPP</dt>
              <dd>Rp 197.000</dd>
            </div>
          </dl>
        </div>

        <p className="relative text-xs text-slate-500">Khusus admin logistik.</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-white lg:hidden">
              <ReceiptText size={22} />
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">Masuk</h1>
            <p className="mt-1 text-sm text-slate-600">Login admin untuk mengelola permintaan &amp; laporan.</p>
          </div>
          <LoginForm next={next && next.startsWith("/") ? next : "/laporan"} />
        </div>
      </section>
    </main>
  );
}
