-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "kodeUnit" TEXT NOT NULL,
    "namaUnit" TEXT NOT NULL,
    "strukturInduk" TEXT,
    "pjUnit" TEXT,
    "nikPj" TEXT,
    "gedung" TEXT,
    "lantai" TEXT,
    "lokasiDetail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Aktif',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Barang" (
    "id" TEXT NOT NULL,
    "kodeItem" TEXT NOT NULL,
    "namaBarang" TEXT NOT NULL,
    "kategori" TEXT,
    "subKategori" TEXT,
    "jenisItem" TEXT,
    "tipeBarang" TEXT,
    "satuanDasar" TEXT NOT NULL,
    "satuanKonversi" TEXT,
    "hargaReferensi" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Aktif',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Barang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarangHargaHistory" (
    "id" TEXT NOT NULL,
    "barangId" TEXT NOT NULL,
    "hargaLama" INTEGER NOT NULL,
    "hargaBaru" INTEGER NOT NULL,
    "sumberPerubahan" TEXT NOT NULL,
    "diubahOleh" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarangHargaHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermintaanMingguan" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "tahun" INTEGER NOT NULL,
    "mingguKe" INTEGER NOT NULL,
    "totalHpp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermintaanMingguan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermintaanItem" (
    "id" TEXT NOT NULL,
    "permintaanMingguanId" TEXT NOT NULL,
    "barangId" TEXT,
    "namaBarangSnapshot" TEXT NOT NULL,
    "satuanSnapshot" TEXT NOT NULL,
    "jumlahBarang" INTEGER NOT NULL,
    "hargaSatuan" INTEGER NOT NULL,
    "harga" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermintaanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_kodeUnit_key" ON "Unit"("kodeUnit");

-- CreateIndex
CREATE INDEX "Unit_namaUnit_idx" ON "Unit"("namaUnit");

-- CreateIndex
CREATE UNIQUE INDEX "Barang_kodeItem_key" ON "Barang"("kodeItem");

-- CreateIndex
CREATE INDEX "Barang_namaBarang_idx" ON "Barang"("namaBarang");

-- CreateIndex
CREATE INDEX "Barang_satuanDasar_idx" ON "Barang"("satuanDasar");

-- CreateIndex
CREATE INDEX "BarangHargaHistory_barangId_idx" ON "BarangHargaHistory"("barangId");

-- CreateIndex
CREATE INDEX "PermintaanMingguan_tahun_mingguKe_idx" ON "PermintaanMingguan"("tahun", "mingguKe");

-- CreateIndex
CREATE UNIQUE INDEX "PermintaanMingguan_unitId_tahun_mingguKe_key" ON "PermintaanMingguan"("unitId", "tahun", "mingguKe");

-- CreateIndex
CREATE INDEX "PermintaanItem_permintaanMingguanId_idx" ON "PermintaanItem"("permintaanMingguanId");

-- CreateIndex
CREATE INDEX "PermintaanItem_barangId_idx" ON "PermintaanItem"("barangId");

-- CreateIndex
CREATE INDEX "PermintaanItem_namaBarangSnapshot_idx" ON "PermintaanItem"("namaBarangSnapshot");

-- AddForeignKey
ALTER TABLE "BarangHargaHistory" ADD CONSTRAINT "BarangHargaHistory_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermintaanMingguan" ADD CONSTRAINT "PermintaanMingguan_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermintaanItem" ADD CONSTRAINT "PermintaanItem_permintaanMingguanId_fkey" FOREIGN KEY ("permintaanMingguanId") REFERENCES "PermintaanMingguan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermintaanItem" ADD CONSTRAINT "PermintaanItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang"("id") ON DELETE SET NULL ON UPDATE CASCADE;
