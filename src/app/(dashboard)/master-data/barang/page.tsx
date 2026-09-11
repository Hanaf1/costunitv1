import Link from "next/link";
import { Search, Upload } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/format";
import { PageHeader } from "../../page-header";
import { buttonPrimary, buttonSecondary, card, badge, input } from "@/lib/ui";

const PAGE_SIZE = 50;

export default async function MasterBarangPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireSession();

  const { q = "", page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw ?? "1") || 1);
  const query = q.trim();

  const where = query
    ? {
        OR: [
          { namaBarang: { contains: query } },
          { kodeItem: { contains: query } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.barang.findMany({
      where,
      orderBy: { namaBarang: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.barang.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Master Barang"
        description={`${total} item terdaftar.`}
        action={
          <Link href="/master-data/import" className={buttonSecondary}>
            <Upload size={16} />
            Import dari Excel
          </Link>
        }
      />

      <form className="flex gap-2" action="/master-data/barang">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Cari nama barang atau kode item..."
            className={`${input} w-full pl-9`}
          />
        </div>
        <button type="submit" className={buttonPrimary}>
          Cari
        </button>
      </form>

      <div className={`overflow-x-auto ${card}`}>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Kode Item</th>
              <th className="px-4 py-2.5 font-medium">Nama Barang</th>
              <th className="px-4 py-2.5 font-medium">Satuan</th>
              <th className="px-4 py-2.5 font-medium text-right">Harga Referensi</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-4 py-2.5 text-slate-600">{item.kodeItem}</td>
                <td className="px-4 py-2.5 font-medium text-slate-900">{item.namaBarang}</td>
                <td className="px-4 py-2.5 text-slate-600">{item.satuanDasar}</td>
                <td className="px-4 py-2.5 text-right text-slate-600">{formatRupiah(item.hargaReferensi)}</td>
                <td className="px-4 py-2.5">
                  <span className={badge(item.status === "Aktif" ? "success" : "neutral")}>{item.status}</span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/master-data/barang/${item.id}`}
                    className="text-sm text-slate-600 hover:text-slate-900 underline underline-offset-2"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/master-data/barang?${new URLSearchParams({ q: query, page: String(p) }).toString()}`}
              className={
                p === page
                  ? "rounded-md bg-slate-900 px-2.5 py-1 font-medium text-white"
                  : "rounded-md px-2.5 py-1 hover:bg-slate-100"
              }
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
