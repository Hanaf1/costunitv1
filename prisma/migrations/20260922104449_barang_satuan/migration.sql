-- AlterTable
ALTER TABLE "PermintaanItem" ADD COLUMN     "isiSnapshot" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "BarangSatuan" (
    "id" TEXT NOT NULL,
    "barangId" TEXT NOT NULL,
    "namaSatuan" TEXT NOT NULL,
    "isi" INTEGER NOT NULL,
    "harga" INTEGER,

    CONSTRAINT "BarangSatuan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BarangSatuan_barangId_namaSatuan_key" ON "BarangSatuan"("barangId", "namaSatuan");

-- AddForeignKey
ALTER TABLE "BarangSatuan" ADD CONSTRAINT "BarangSatuan_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang"("id") ON DELETE CASCADE ON UPDATE CASCADE;
