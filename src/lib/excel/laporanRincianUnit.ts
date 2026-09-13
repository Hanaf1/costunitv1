import ExcelJS from "exceljs";
import type { LaporanDetailRow, LaporanResult } from "@/lib/services/laporan";
import { weekRange } from "@/lib/week";

// Export "format lama": meniru september.xlsx (RINCIAN PERMINTAAN BARANG PER UNIT).
// Satu blok per minggu, kolom per unit (No | Nama Barang | Jumlah | Harga Satuan | Harga),
// kolom B/C berisi HPP per unit, C7 = total semua minggu, dan rekap per unit di paling bawah.
// Semua total ditulis sebagai rumus Excel supaya tetap hidup kalau file diedit manual.

// Urutan unit mengikuti file Excel lama; unit lain menyusul urut abjad.
const UNIT_ORDER = [
  "KASIR", "IGD", "PENDAFTARAN", "MADINAH 2", "PPI", "FARMASI", "POLI", "RADIOLOGI", "LABORAT",
  "OK", "VK", "MULTAZAM", "MARWA", "HK", "LAUNDRY", "LOGISTIK", "ASURANSI", "FISIOTERAPI", "AULA",
  "MUSDALIFAH", "ICU", "GIZI", "MADINAH 3", "AROFAH", "MADINAH 4",
];

const BULAN = [
  "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
  "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER",
];

const FIRST_UNIT_COL = 4; // kolom D
const COLS_PER_UNIT = 5;
const FIRST_BLOCK_ROW = 8;

const FMT_ACCOUNTING = '_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@_-';
const FMT_NUMBER = "#,##0";

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};
const solid = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const FILL_HEADER = solid("FFBDD7EE");
const FILL_HEADER_UNIT = solid("FFF8CBAD");
const FILL_DATE = solid("FF92D050");
const FILL_TOTAL = solid("FFFFFF00");
const FILL_GRAND = solid("FFFFC000");

type UnitCol = { unitId: string; nama: string; no: number; nameCol: number; qtyCol: number; priceCol: number; hargaCol: number };

type WeekBlock = {
  tahun: number;
  mingguKe: number;
  senin: Date;
  itemsByUnit: Map<string, LaporanDetailRow[]>;
};

function col(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function unitRank(nama: string): number {
  const upper = nama.trim().toUpperCase();
  const idx = UNIT_ORDER.findIndex(
    (key) => upper === key || upper.startsWith(`${key} `) || upper.startsWith(`${key}(`) || (key.length >= 4 && upper.startsWith(key)),
  );
  return idx === -1 ? UNIT_ORDER.length : idx;
}

function toExcelDate(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function formatTanggal(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function periodeLabel(blocks: WeekBlock[]): { title: string; sheetName: string } {
  // Minggu ISO dimasukkan ke bulan hari Kamis-nya (minggu 31 Agt - 6 Sep = September).
  const months = new Set(
    blocks.map((b) => {
      const kamis = new Date(b.senin.getFullYear(), b.senin.getMonth(), b.senin.getDate() + 3);
      return `${kamis.getFullYear()}-${kamis.getMonth()}`;
    }),
  );
  if (months.size === 1) {
    const [y, m] = [...months][0].split("-").map(Number);
    const label = `${BULAN[m]} ${y}`;
    return { title: `BULAN ${label}`, sheetName: label };
  }
  const first = blocks[0].senin;
  const last = weekRange(blocks[blocks.length - 1].tahun, blocks[blocks.length - 1].mingguKe).end;
  return { title: `PERIODE ${formatTanggal(first)} - ${formatTanggal(last)}`, sheetName: "RINCIAN PER UNIT" };
}

export async function buildLaporanRincianUnitWorkbook(result: LaporanResult): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Cost Unit Report";
  workbook.created = new Date();
  workbook.calcProperties = { fullCalcOnLoad: true };

  // Kelompokkan detail per minggu lalu per unit; hanya barang yang benar-benar diminta.
  const blockMap = new Map<string, WeekBlock>();
  const unitNames = new Map<string, string>();
  const rows = [...result.detail].reverse(); // detail diurutkan tanggal desc; balik agar urutan input terjaga
  for (const row of rows) {
    unitNames.set(row.unitId, row.namaUnit.trim().toUpperCase());
    const key = `${row.tahun}-${row.mingguKe}`;
    let block = blockMap.get(key);
    if (!block) {
      block = { tahun: row.tahun, mingguKe: row.mingguKe, senin: weekRange(row.tahun, row.mingguKe).start, itemsByUnit: new Map() };
      blockMap.set(key, block);
    }
    const list = block.itemsByUnit.get(row.unitId) ?? [];
    list.push(row);
    block.itemsByUnit.set(row.unitId, list);
  }
  const blocks = [...blockMap.values()].sort((a, b) => a.tahun - b.tahun || a.mingguKe - b.mingguKe);

  const units: UnitCol[] = [...unitNames.entries()]
    .sort(([, a], [, b]) => unitRank(a) - unitRank(b) || a.localeCompare(b))
    .map(([unitId, nama], i) => {
      const no = FIRST_UNIT_COL + i * COLS_PER_UNIT;
      return { unitId, nama, no, nameCol: no + 1, qtyCol: no + 2, priceCol: no + 3, hargaCol: no + 4 };
    });

  const periode = blocks.length > 0 ? periodeLabel(blocks) : { title: "TIDAK ADA DATA", sheetName: "RINCIAN PER UNIT" };
  const ws = workbook.addWorksheet(periode.sheetName, { views: [{ zoomScale: 85 }] });

  const lastCol = Math.max(18, FIRST_UNIT_COL + units.length * COLS_PER_UNIT - 1);
  const titleFont: Partial<ExcelJS.Font> = { name: "Times New Roman", size: 20, bold: true };
  ws.mergeCells(1, 1, 2, lastCol);
  ws.getCell(1, 1).value = "RINCIAN PERMINTAAN BARANG PER UNIT";
  ws.mergeCells(3, 1, 4, lastCol);
  ws.getCell(3, 1).value = periode.title;
  for (const r of [1, 3]) {
    ws.getCell(r, 1).font = titleFont;
    ws.getCell(r, 1).alignment = { horizontal: "center", vertical: "middle" };
  }

  ws.getColumn(1).width = 12.5;
  ws.getColumn(2).width = 20;
  ws.getColumn(3).width = 13;
  for (const u of units) {
    ws.getColumn(u.no).width = 5;
    ws.getColumn(u.nameCol).width = 24;
    ws.getColumn(u.qtyCol).width = 9;
    ws.getColumn(u.priceCol).width = 10;
    ws.getColumn(u.hargaCol).width = 12;
  }

  const style = (
    cell: ExcelJS.Cell,
    opts: { fill?: ExcelJS.Fill; bold?: boolean; numFmt?: string; align?: Partial<ExcelJS.Alignment> } = {},
  ) => {
    cell.border = BORDER;
    cell.font = { name: "Calibri", size: 11, bold: opts.bold };
    if (opts.fill) cell.fill = opts.fill;
    if (opts.numFmt) cell.numFmt = opts.numFmt;
    if (opts.align) cell.alignment = opts.align;
  };
  const center: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: true };

  if (units.length === 0) {
    ws.getCell(6, 1).value = "Tidak ada permintaan barang untuk filter ini.";
    const empty = await workbook.xlsx.writeBuffer();
    return Buffer.from(empty);
  }

  const blockTotals: { row: number; value: number }[] = [];
  const unitHppCells: string[][] = units.map(() => []);
  const unitHppValues: number[] = units.map(() => 0);
  let firstBlockDataRow = 0;
  let r = FIRST_BLOCK_ROW;

  for (const block of blocks) {
    const headerRow = r;
    const subHeaderRow = r + 1;
    const dataStart = r + 2;
    const rowCount = Math.max(units.length, ...units.map((u) => block.itemsByUnit.get(u.unitId)?.length ?? 0));
    const dataEnd = dataStart + rowCount - 1;
    const totalRow = dataEnd + 1;
    if (!firstBlockDataRow) firstBlockDataRow = dataStart;

    // Header 2 baris
    for (const [c, label, fill] of [
      [1, "Tanggal", FILL_HEADER],
      [2, "Nama Unit", FILL_HEADER_UNIT],
      [3, "HPP", FILL_HEADER_UNIT],
    ] as const) {
      ws.mergeCells(headerRow, c, subHeaderRow, c);
      ws.getCell(headerRow, c).value = label;
      style(ws.getCell(headerRow, c), { fill, align: center });
    }
    for (const u of units) {
      ws.mergeCells(headerRow, u.no, subHeaderRow, u.no);
      ws.getCell(headerRow, u.no).value = "No";
      style(ws.getCell(headerRow, u.no), { fill: FILL_HEADER, align: center });
      ws.mergeCells(headerRow, u.nameCol, headerRow, u.hargaCol);
      ws.getCell(headerRow, u.nameCol).value = u.nama;
      style(ws.getCell(headerRow, u.nameCol), { fill: FILL_HEADER, bold: true, align: center });
      const subs: [number, string][] = [
        [u.nameCol, "Nama Barang"],
        [u.qtyCol, "Jumlah Barang"],
        [u.priceCol, "Harga Satuan"],
        [u.hargaCol, "Harga"],
      ];
      for (const [c, label] of subs) {
        ws.getCell(subHeaderRow, c).value = label;
        style(ws.getCell(subHeaderRow, c), { fill: FILL_HEADER, align: center });
      }
    }
    ws.getRow(subHeaderRow).height = 28.8;

    // Baris data
    const unitTotals = units.map((u) => (block.itemsByUnit.get(u.unitId) ?? []).reduce((s, it) => s + it.harga, 0));
    for (let i = 0; i < rowCount; i++) {
      const row = dataStart + i;
      const dateCell = ws.getCell(row, 1);
      if (i === 0) {
        dateCell.value = toExcelDate(block.senin);
        style(dateCell, { fill: FILL_DATE, numFmt: "dd/mm/yyyy", align: { horizontal: "center" } });
      } else {
        style(dateCell);
      }

      const bCell = ws.getCell(row, 2);
      const cCell = ws.getCell(row, 3);
      if (i < units.length) {
        const u = units[i];
        bCell.value = { formula: `${col(u.nameCol)}${headerRow}`, result: u.nama };
        cCell.value = { formula: `${col(u.hargaCol)}${totalRow}`, result: unitTotals[i] };
        unitHppCells[i].push(`C${row}`);
        unitHppValues[i] += unitTotals[i];
      }
      style(bCell);
      style(cCell, { numFmt: FMT_ACCOUNTING });

      units.forEach((u) => {
        const item = block.itemsByUnit.get(u.unitId)?.[i];
        const noCell = ws.getCell(row, u.no);
        const nameCell = ws.getCell(row, u.nameCol);
        const qtyCell = ws.getCell(row, u.qtyCol);
        const priceCell = ws.getCell(row, u.priceCol);
        const hargaCell = ws.getCell(row, u.hargaCol);
        if (item) {
          noCell.value = i + 1;
          nameCell.value = item.namaBarangSnapshot;
          qtyCell.value = item.jumlahBarang;
          priceCell.value = item.hargaSatuan;
        }
        hargaCell.value = {
          formula: `${col(u.qtyCol)}${row}*${col(u.priceCol)}${row}`,
          result: item ? item.harga : 0,
        };
        style(noCell, { align: { horizontal: "center", vertical: "middle" } });
        style(nameCell, { align: { horizontal: "left", wrapText: true } });
        style(qtyCell, { align: { horizontal: "center", vertical: "middle" } });
        style(priceCell, { numFmt: FMT_NUMBER, align: { horizontal: "right", vertical: "middle" } });
        style(hargaCell, { numFmt: FMT_ACCOUNTING });
      });
    }

    // Baris total (kuning)
    const blockTotal = unitTotals.reduce((s, v) => s + v, 0);
    style(ws.getCell(totalRow, 1), { fill: FILL_TOTAL });
    ws.getCell(totalRow, 2).value = "Jumlah";
    style(ws.getCell(totalRow, 2), { fill: FILL_TOTAL, bold: true });
    ws.getCell(totalRow, 3).value = { formula: `SUM(C${dataStart}:C${dataEnd})`, result: blockTotal };
    style(ws.getCell(totalRow, 3), { fill: FILL_TOTAL, bold: true, numFmt: FMT_ACCOUNTING });
    units.forEach((u, i) => {
      ws.mergeCells(totalRow, u.no, totalRow, u.priceCol);
      ws.getCell(totalRow, u.no).value = "Total Pengeluaran";
      style(ws.getCell(totalRow, u.no), { fill: FILL_TOTAL, bold: true, align: { horizontal: "center" } });
      const h = col(u.hargaCol);
      ws.getCell(totalRow, u.hargaCol).value = { formula: `SUM(${h}${dataStart}:${h}${dataEnd})`, result: unitTotals[i] };
      style(ws.getCell(totalRow, u.hargaCol), { fill: FILL_TOTAL, bold: true, numFmt: FMT_ACCOUNTING });
    });
    blockTotals.push({ row: totalRow, value: blockTotal });

    r = totalRow + 1;
  }

  // C7: total HPP semua minggu
  const grandTotal = blockTotals.reduce((s, b) => s + b.value, 0);
  const grandCell = ws.getCell(7, 3);
  grandCell.value = { formula: blockTotals.map((b) => `C${b.row}`).join("+"), result: grandTotal };
  grandCell.fill = FILL_GRAND;
  grandCell.numFmt = FMT_ACCOUNTING;
  grandCell.font = { name: "Calibri", size: 11, bold: true };

  // Rekap per unit di paling bawah: nama unit + jumlah HPP semua minggu, ditutup baris Jumlah.
  const recapStart = r + 2;
  units.forEach((u, i) => {
    const row = recapStart + i;
    ws.getCell(row, 2).value = { formula: `B${firstBlockDataRow + i}`, result: u.nama };
    ws.getCell(row, 3).value = { formula: unitHppCells[i].join("+"), result: unitHppValues[i] };
    style(ws.getCell(row, 2));
    style(ws.getCell(row, 3), { numFmt: FMT_ACCOUNTING });
  });
  const recapEnd = recapStart + units.length - 1;
  const recapTotalRow = recapEnd + 1;
  ws.getCell(recapTotalRow, 2).value = "Jumlah";
  style(ws.getCell(recapTotalRow, 2), { fill: FILL_TOTAL, bold: true });
  ws.getCell(recapTotalRow, 3).value = { formula: `SUM(C${recapStart}:C${recapEnd})`, result: grandTotal };
  style(ws.getCell(recapTotalRow, 3), { fill: FILL_TOTAL, bold: true, numFmt: FMT_ACCOUNTING });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
