import ExcelJS from "exceljs";

// Parser untuk file export "Master Barang" & "Master Unit" (lihat contoh file
// master-barang-*.xlsx / master-unit-*.xlsx di root project). Header dicari
// berdasarkan teks kolom (bukan nomor baris tetap) supaya tetap jalan walau
// baris info di atas tabel berubah jumlahnya.

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String((value as { text: unknown }).text ?? "");
  if (typeof value === "object" && "result" in value) return String((value as { result: unknown }).result ?? "");
  return String(value).trim();
}

function cellNumber(value: ExcelJS.CellValue): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  const text = cellText(value).replace(/[^0-9.-]/g, "");
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

type HeaderMap = Record<string, number>;

function findHeaderRow(
  sheet: ExcelJS.Worksheet,
  requiredHeaders: string[],
): { rowNumber: number; colMap: HeaderMap } | null {
  const normalizedRequired = requiredHeaders.map((h) => h.toLowerCase());

  for (let r = 1; r <= Math.min(sheet.rowCount, 30); r++) {
    const row = sheet.getRow(r);
    const colMap: HeaderMap = {};
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = cellText(cell.value).toLowerCase();
      if (text) colMap[text] = colNumber;
    });
    const hasAll = normalizedRequired.every((h) => h in colMap);
    if (hasAll) {
      return { rowNumber: r, colMap };
    }
  }
  return null;
}

export type ParsedUnitRow = {
  kodeUnit: string;
  namaUnit: string;
  strukturInduk: string | null;
  pjUnit: string | null;
  nikPj: string | null;
  gedung: string | null;
  lantai: string | null;
  lokasiDetail: string | null;
  status: string;
};

export type ParseResult<T> = {
  rows: T[];
  errors: string[];
};

const UNIT_REQUIRED_HEADERS = ["kode unit", "nama unit"];

export async function parseMasterUnitWorkbook(
  buffer: ArrayBuffer | Buffer,
): Promise<ParseResult<ParsedUnitRow>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  const errors: string[] = [];
  const rows: ParsedUnitRow[] = [];

  if (!sheet) {
    return { rows, errors: ["File xlsx tidak berisi sheet apapun."] };
  }

  const header = findHeaderRow(sheet, UNIT_REQUIRED_HEADERS);
  if (!header) {
    return {
      rows,
      errors: [`Header kolom "Kode Unit" / "Nama Unit" tidak ditemukan di file ini.`],
    };
  }

  const { rowNumber: headerRow, colMap } = header;
  const col = (name: string) => colMap[name];

  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const kodeUnit = cellText(row.getCell(col("kode unit")).value);
    const namaUnit = cellText(row.getCell(col("nama unit")).value);

    if (!kodeUnit && !namaUnit) continue; // baris kosong, lewati

    if (!kodeUnit || !namaUnit) {
      errors.push(`Baris ${r}: Kode Unit atau Nama Unit kosong, dilewati.`);
      continue;
    }

    rows.push({
      kodeUnit,
      namaUnit,
      strukturInduk: col("struktur induk") ? cellText(row.getCell(col("struktur induk")).value) || null : null,
      pjUnit: col("pj unit") ? cellText(row.getCell(col("pj unit")).value) || null : null,
      nikPj: col("nik pj") ? cellText(row.getCell(col("nik pj")).value) || null : null,
      gedung: col("gedung") ? cellText(row.getCell(col("gedung")).value) || null : null,
      lantai: col("lantai") ? cellText(row.getCell(col("lantai")).value) || null : null,
      lokasiDetail: col("lokasi detail") ? cellText(row.getCell(col("lokasi detail")).value) || null : null,
      status: (col("status") ? cellText(row.getCell(col("status")).value) : "") || "Aktif",
    });
  }

  return { rows, errors };
}

export type ParsedBarangRow = {
  kodeItem: string;
  namaBarang: string;
  kategori: string | null;
  subKategori: string | null;
  jenisItem: string | null;
  tipeBarang: string | null;
  satuanDasar: string;
  satuanKonversi: string | null;
  hargaReferensi: number;
  status: string;
};

const BARANG_REQUIRED_HEADERS = ["kode item", "nama barang", "satuan dasar", "harga referensi (hps)"];

export async function parseMasterBarangWorkbook(
  buffer: ArrayBuffer | Buffer,
): Promise<ParseResult<ParsedBarangRow>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  const errors: string[] = [];
  const rows: ParsedBarangRow[] = [];

  if (!sheet) {
    return { rows, errors: ["File xlsx tidak berisi sheet apapun."] };
  }

  const header = findHeaderRow(sheet, BARANG_REQUIRED_HEADERS);
  if (!header) {
    return {
      rows,
      errors: [
        `Header kolom "Kode Item" / "Nama Barang" / "Satuan Dasar" / "Harga Referensi (HPS)" tidak ditemukan di file ini.`,
      ],
    };
  }

  const { rowNumber: headerRow, colMap } = header;
  const col = (name: string) => colMap[name];

  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const kodeItem = cellText(row.getCell(col("kode item")).value);
    const namaBarang = cellText(row.getCell(col("nama barang")).value);

    if (!kodeItem && !namaBarang) continue;

    if (!kodeItem || !namaBarang) {
      errors.push(`Baris ${r}: Kode Item atau Nama Barang kosong, dilewati.`);
      continue;
    }

    const satuanDasar = cellText(row.getCell(col("satuan dasar")).value) || "Pcs";
    const hargaReferensi = cellNumber(row.getCell(col("harga referensi (hps)")).value);

    if (hargaReferensi === null) {
      errors.push(`Baris ${r} (${kodeItem}): Harga Referensi (HPS) tidak valid, dilewati.`);
      continue;
    }

    rows.push({
      kodeItem,
      namaBarang,
      kategori: col("kategori") ? cellText(row.getCell(col("kategori")).value) || null : null,
      subKategori: col("sub kategori") ? cellText(row.getCell(col("sub kategori")).value) || null : null,
      jenisItem: col("jenis item") ? cellText(row.getCell(col("jenis item")).value) || null : null,
      tipeBarang: col("tipe barang") ? cellText(row.getCell(col("tipe barang")).value) || null : null,
      satuanDasar,
      satuanKonversi: col("satuan konversi") ? cellText(row.getCell(col("satuan konversi")).value) || null : null,
      hargaReferensi: Math.round(hargaReferensi),
      status: (col("status") ? cellText(row.getCell(col("status")).value) : "") || "Aktif",
    });
  }

  return { rows, errors };
}
