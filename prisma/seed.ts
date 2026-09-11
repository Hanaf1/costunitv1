import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { parseMasterBarangWorkbook, parseMasterUnitWorkbook } from "@/lib/excel/masterData";
import { upsertBarangFromImport, upsertUnitsFromImport } from "@/lib/services/masterData";

const ROOT = path.resolve(__dirname, "..");

async function findFile(prefix: string): Promise<string | null> {
  const files = await readdir(ROOT);
  const match = files.find((f) => f.startsWith(prefix) && f.endsWith(".xlsx"));
  return match ? path.join(ROOT, match) : null;
}

async function main() {
  const unitFile = await findFile("master-unit");
  const barangFile = await findFile("master-barang");

  if (unitFile) {
    const buffer = await readFile(unitFile);
    const { rows, errors } = await parseMasterUnitWorkbook(buffer);
    const result = await upsertUnitsFromImport(rows);
    console.log(`Master Unit (${path.basename(unitFile)}): ${result.created} baru, ${result.updated} update.`);
    if (errors.length) console.log("  Peringatan:", errors.join(" | "));
  } else {
    console.log("File master-unit-*.xlsx tidak ditemukan di root project, dilewati.");
  }

  if (barangFile) {
    const buffer = await readFile(barangFile);
    const { rows, errors } = await parseMasterBarangWorkbook(buffer);
    const result = await upsertBarangFromImport(rows);
    console.log(
      `Master Barang (${path.basename(barangFile)}): ${result.created} baru, ${result.updated} update, ${result.hargaChanged} harga berubah.`,
    );
    if (errors.length) console.log("  Peringatan:", errors.join(" | "));
  } else {
    console.log("File master-barang-*.xlsx tidak ditemukan di root project, dilewati.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
