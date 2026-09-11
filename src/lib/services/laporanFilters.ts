import type { LaporanFilters } from "./laporan";

export type LaporanSearchParams = {
  mode?: string;
  minggu?: string; // format "tahun-mingguKe", contoh "2026-3"
  start?: string;
  end?: string;
  unit?: string | string[];
  barang?: string | string[];
  satuan?: string | string[];
  groupBy?: string;
};

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

export function parseLaporanSearchParams(sp: LaporanSearchParams): LaporanFilters {
  const mode = sp.mode === "minggu" ? "minggu" : "rentang";

  let tahun: number | undefined;
  let mingguKe: number | undefined;
  if (mode === "minggu" && sp.minggu) {
    const [t, m] = sp.minggu.split("-").map(Number);
    if (Number.isFinite(t) && Number.isFinite(m)) {
      tahun = t;
      mingguKe = m;
    }
  }

  const startDate = mode === "rentang" && sp.start ? new Date(`${sp.start}T00:00:00`) : undefined;
  const endDate = mode === "rentang" && sp.end ? new Date(`${sp.end}T23:59:59`) : undefined;

  return {
    mode,
    tahun,
    mingguKe,
    startDate: startDate && !Number.isNaN(startDate.getTime()) ? startDate : undefined,
    endDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate : undefined,
    unitIds: toArray(sp.unit),
    barangIds: toArray(sp.barang),
    satuan: toArray(sp.satuan),
  };
}
