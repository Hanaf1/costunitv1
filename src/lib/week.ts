import {
  getISOWeek,
  getISOWeekYear,
  setISOWeek,
  setISOWeekYear,
  startOfISOWeek,
  endOfISOWeek,
  format,
} from "date-fns";

// Definisi "minggu" yang dipakai di seluruh app: ISO week (Senin-Minggu).
// Lihat PRD-cost-unit-report.md bagian Open Questions - keputusan desain.

export type WeekInfo = {
  tahun: number;
  mingguKe: number;
  senin: Date;
};

export function isoWeekInfo(date: Date): WeekInfo {
  return {
    tahun: getISOWeekYear(date),
    mingguKe: getISOWeek(date),
    senin: startOfISOWeek(date),
  };
}

export function weekRange(tahun: number, mingguKe: number): { start: Date; end: Date } {
  let d = setISOWeekYear(new Date(tahun, 0, 4), tahun);
  d = setISOWeek(d, mingguKe);
  return {
    start: startOfISOWeek(d),
    end: endOfISOWeek(d),
  };
}

export function weekLabel(tahun: number, mingguKe: number): string {
  const { start, end } = weekRange(tahun, mingguKe);
  return `Minggu ${mingguKe} / ${tahun} (${format(start, "d MMM")} - ${format(end, "d MMM yyyy")})`;
}
