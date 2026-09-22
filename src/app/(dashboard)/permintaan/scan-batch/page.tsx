import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBarangOptions } from "@/lib/services/permintaan";
import { PageHeader } from "../../page-header";
import { BatchScanner } from "./batch-scanner";
import { buttonSecondary } from "@/lib/ui";

export default async function ScanBatchPage() {
  await requireSession();

  const [units, barang, existing] = await Promise.all([
    prisma.unit.findMany({ where: { status: "Aktif" }, select: { id: true, namaUnit: true }, orderBy: { namaUnit: "asc" } }),
    getBarangOptions(),
    prisma.permintaanMingguan.findMany({ select: { unitId: true, tahun: true, mingguKe: true } }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Scan Batch Formulir"
        description="Foto beberapa formulir permintaan sekaligus (boleh dari banyak unit). Periksa hasil baca AI, lalu simpan semua."
        action={
          <Link href="/permintaan" className={buttonSecondary}>
            <ArrowLeft size={16} />
            Kembali
          </Link>
        }
      />
      <BatchScanner
        units={units}
        barangOptions={barang}
        existingWeeks={existing.map((e) => `${e.unitId}|${e.tahun}-W${String(e.mingguKe).padStart(2, "0")}`)}
      />
    </div>
  );
}
