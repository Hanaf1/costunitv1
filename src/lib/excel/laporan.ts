import ExcelJS from "exceljs";
import type { LaporanResult } from "@/lib/services/laporan";

export async function buildLaporanWorkbook(
  result: LaporanResult,
  context: { filterLabel: string },
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Cost Unit Report";
  workbook.created = new Date();

  const currencyFormat = "#,##0";

  const summaryUnitSheet = workbook.addWorksheet("Ringkasan per Unit");
  summaryUnitSheet.addRow([`Filter: ${context.filterLabel}`]);
  summaryUnitSheet.addRow([]);
  summaryUnitSheet.addRow(["Unit", "Total Permintaan", "Total Harga (Rp)"]).font = { bold: true };
  for (const row of result.summaryByUnit) {
    summaryUnitSheet.addRow([row.label, row.totalPermintaan, row.totalHarga]);
  }
  summaryUnitSheet.addRow([]);
  const grandRowUnit = summaryUnitSheet.addRow([
    "GRAND TOTAL",
    result.grandTotal.totalPermintaan,
    result.grandTotal.totalHarga,
  ]);
  grandRowUnit.font = { bold: true };
  summaryUnitSheet.getColumn(3).numFmt = currencyFormat;
  summaryUnitSheet.getColumn(1).width = 30;
  summaryUnitSheet.getColumn(2).width = 18;
  summaryUnitSheet.getColumn(3).width = 20;

  const summaryItemSheet = workbook.addWorksheet("Ringkasan per Item");
  summaryItemSheet.addRow([`Filter: ${context.filterLabel}`]);
  summaryItemSheet.addRow([]);
  summaryItemSheet.addRow(["Nama Barang (Satuan)", "Total Permintaan", "Total Harga (Rp)"]).font = {
    bold: true,
  };
  for (const row of result.summaryByItem) {
    summaryItemSheet.addRow([row.label, row.totalPermintaan, row.totalHarga]);
  }
  summaryItemSheet.addRow([]);
  const grandRowItem = summaryItemSheet.addRow([
    "GRAND TOTAL",
    result.grandTotal.totalPermintaan,
    result.grandTotal.totalHarga,
  ]);
  grandRowItem.font = { bold: true };
  summaryItemSheet.getColumn(3).numFmt = currencyFormat;
  summaryItemSheet.getColumn(1).width = 40;
  summaryItemSheet.getColumn(2).width = 18;
  summaryItemSheet.getColumn(3).width = 20;

  const detailSheet = workbook.addWorksheet("Detail");
  detailSheet.addRow([`Filter: ${context.filterLabel}`]);
  detailSheet.addRow([]);
  detailSheet
    .addRow([
      "Tanggal",
      "Minggu",
      "Unit",
      "Nama Barang",
      "Satuan",
      "Jumlah",
      "Harga Satuan (Rp)",
      "Harga (Rp)",
    ])
    .font = { bold: true };
  for (const row of result.detail) {
    detailSheet.addRow([
      row.tanggal,
      `${row.mingguKe}/${row.tahun}`,
      row.namaUnit,
      row.namaBarangSnapshot,
      row.satuanSnapshot,
      row.jumlahBarang,
      row.hargaSatuan,
      row.harga,
    ]);
  }
  detailSheet.addRow([]);
  const grandRowDetail = detailSheet.addRow([
    "", "", "", "", "GRAND TOTAL",
    result.grandTotal.totalPermintaan,
    "",
    result.grandTotal.totalHarga,
  ]);
  grandRowDetail.font = { bold: true };
  detailSheet.getColumn(1).numFmt = "dd/mm/yyyy";
  detailSheet.getColumn(7).numFmt = currencyFormat;
  detailSheet.getColumn(8).numFmt = currencyFormat;
  detailSheet.columns.forEach((col) => {
    col.width = 18;
  });
  detailSheet.getColumn(4).width = 35;

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
