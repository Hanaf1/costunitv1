import type { NextRequest } from "next/server";
import { getSessionUsername } from "@/lib/auth";
import { parseLaporanSearchParams } from "@/lib/services/laporanFilters";
import { describeFilters, getLaporanData } from "@/lib/services/laporan";
import { buildLaporanWorkbook } from "@/lib/excel/laporan";
import { buildLaporanRincianUnitWorkbook } from "@/lib/excel/laporanRincianUnit";

export async function GET(request: NextRequest) {
  const username = await getSessionUsername();
  if (!username) {
    return new Response(null, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const filters = parseLaporanSearchParams({
    mode: sp.get("mode") ?? undefined,
    minggu: sp.get("minggu") ?? undefined,
    start: sp.get("start") ?? undefined,
    end: sp.get("end") ?? undefined,
    unit: sp.getAll("unit"),
    barang: sp.getAll("barang"),
    satuan: sp.getAll("satuan"),
  });

  const rincianUnit = sp.get("format") === "rincian-unit";

  const [result, filterLabel] = await Promise.all([getLaporanData(filters), describeFilters(filters)]);
  const buffer = rincianUnit
    ? await buildLaporanRincianUnitWorkbook(result)
    : await buildLaporanWorkbook(result, { filterLabel });

  const prefix = rincianUnit ? "rincian-permintaan-per-unit" : "laporan-cost-unit";
  const filename = `${prefix}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
