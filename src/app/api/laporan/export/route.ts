import type { NextRequest } from "next/server";
import { getSessionUsername } from "@/lib/auth";
import { parseLaporanSearchParams } from "@/lib/services/laporanFilters";
import { describeFilters, getLaporanData } from "@/lib/services/laporan";
import { buildLaporanWorkbook } from "@/lib/excel/laporan";

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

  const [result, filterLabel] = await Promise.all([getLaporanData(filters), describeFilters(filters)]);
  const buffer = await buildLaporanWorkbook(result, { filterLabel });

  const filename = `laporan-cost-unit-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
