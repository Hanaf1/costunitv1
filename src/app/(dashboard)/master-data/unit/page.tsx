import Link from "next/link";
import { Upload } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "../../page-header";
import { buttonSecondary, card, badge } from "@/lib/ui";

export default async function MasterUnitPage() {
  await requireSession();

  const units = await prisma.unit.findMany({ orderBy: { namaUnit: "asc" } });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Master Unit"
        description={`${units.length} unit terdaftar.`}
        action={
          <Link href="/master-data/import" className={buttonSecondary}>
            <Upload size={16} />
            Import dari Excel
          </Link>
        }
      />

      <div className={`overflow-x-auto ${card}`}>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Kode Unit</th>
              <th className="px-4 py-2.5 font-medium">Nama Unit</th>
              <th className="px-4 py-2.5 font-medium">Struktur Induk</th>
              <th className="px-4 py-2.5 font-medium">Gedung / Lantai</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr key={unit.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-4 py-2.5 text-slate-600">{unit.kodeUnit}</td>
                <td className="px-4 py-2.5 font-medium text-slate-900">{unit.namaUnit}</td>
                <td className="px-4 py-2.5 text-slate-600">{unit.strukturInduk ?? "-"}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {[unit.gedung, unit.lantai].filter(Boolean).join(" / ") || "-"}
                </td>
                <td className="px-4 py-2.5">
                  <span className={badge(unit.status === "Aktif" ? "success" : "neutral")}>{unit.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
