# PRD: Laporan Cost Unit per Minggu Permintaan

- **Dokumen:** Product Requirements Document
- **Modul:** Input Permintaan Mingguan & Laporan Cost Unit
- **Platform:** Next.js (App Router), deploy Vercel
- **Status:** Draft v1

---

## 1. Overview & Background

Saat ini pencatatan permintaan barang mingguan per unit (KASIR, IGD, PENDAFTARAN, FARMASI, dst — total 45 unit) masih dikerjakan manual di spreadsheet: satu baris "Tanggal" mewakili satu minggu, lalu untuk setiap unit ada blok kolom sendiri (Nama Barang, Jumlah Barang, Harga Satuan, Harga), dan kolom HPP berisi total biaya unit tersebut pada minggu itu.

Proses ini punya beberapa masalah:
- Sulit merekap total permintaan & total biaya per unit/per item lintas minggu — harus dihitung manual dari banyak sheet/blok kolom.
- Tidak ada cara cepat memfilter "berapa total permintaan item X di unit Y selama bulan Z" tanpa membuka & menjumlah manual.
- Data master (daftar unit, daftar barang & harga referensi) sudah ada dalam bentuk export sistem "Logistik Non Medis" (`master-barang-*.xlsx`, `master-unit-*.xlsx`) tapi belum terhubung ke proses input permintaan mingguan.

**Tujuan:** Membangun aplikasi web (Next.js di Vercel) yang mendigitalkan input permintaan mingguan per unit, dan menyediakan laporan Cost Unit yang bisa difilter secara fleksibel (per minggu atau rentang tanggal/tahun, per unit, per item, per satuan), menampilkan total permintaan & total harga, serta bisa diexport ke Excel.

## 2. Goals & Non-Goals

### Goals (v1)
- Import master data Unit & Barang dari file xlsx yang sudah ada.
- Edit manual data master Barang (termasuk koreksi harga) langsung dari UI, dengan riwayat perubahan harga.
- Input permintaan mingguan per unit dengan kalkulasi harga & total HPP otomatis.
- Laporan Cost Unit dengan filter kombinasi: periode (minggu ATAU rentang tanggal/tahun), unit, item, satuan.
- Laporan menampilkan Total Permintaan (jumlah barang) dan Total Harga, plus detail baris.
- Export hasil laporan ke Excel (.xlsx).

### Non-Goals (v1)
- Login/role per unit (unit lain kirim data ke admin secara offline; hanya 1 admin yang punya akses app).
- Approval/workflow persetujuan permintaan.
- Integrasi langsung ke sistem Logistik Non Medis yang jadi sumber file xlsx (masih via import manual file).

## 3. Data Model

Konsep model data (akan diimplementasikan sebagai Prisma schema di atas Postgres):

### `Unit`
Sumber: `master-unit-*.xlsx`
| Field | Keterangan |
|---|---|
| kodeUnit | unik, contoh `UNT-2026070009` |
| namaUnit | contoh `IGD` |
| strukturInduk | contoh `KA SIE PELAYANAN MEDIS` |
| pjUnit, nikPj | penanggung jawab unit |
| gedung, lantai, lokasiDetail | |
| status | Aktif/Nonaktif |

### `Barang` (Item)
Sumber: `master-barang-*.xlsx`
| Field | Keterangan |
|---|---|
| kodeItem | unik, contoh `BRG0920260050` |
| namaBarang | contoh `plastik hitam 40` |
| kategori, subKategori, jenisItem, tipeBarang | |
| satuanDasar | contoh `Pcs`, `Lembar`, `Pack` — dipakai untuk filter Satuan |
| satuanKonversi | contoh `1 Pack = 20 Lembar` |
| hargaReferensi | HPS terbaru — default harga satuan saat input permintaan |
| status | Aktif/Nonaktif |

### `BarangHargaHistory` (riwayat perubahan harga master Barang)
| Field | Keterangan |
|---|---|
| barangId | relasi ke Barang |
| hargaLama, hargaBaru | nilai `hargaReferensi` sebelum & sesudah diubah |
| sumberPerubahan | `Import` (dari re-import xlsx) atau `Edit Manual` |
| diubahOleh, diubahPada | audit siapa & kapan |

> Riwayat ini hanya mencatat perubahan `hargaReferensi` di master Barang — **tidak** otomatis mengubah `PermintaanItem` yang sudah tersimpan (tetap pakai snapshot harga saat itu), karena tujuannya laporan minggu lalu tidak ikut berubah saat harga referensi dikoreksi belakangan.

### `PermintaanMingguan` (header — 1 per unit per minggu)
| Field | Keterangan |
|---|---|
| unitId | relasi ke Unit |
| tanggal | tanggal representatif minggu tersebut (sesuai pola sheet asli) |
| tahun, mingguKe | derived dari tanggal, disimpan eksplisit untuk mempercepat filter "pilih minggu" |
| totalHpp | **computed** = SUM(harga) semua `PermintaanItem` di dalamnya |

### `PermintaanItem` (detail baris permintaan)
| Field | Keterangan |
|---|---|
| permintaanMingguanId | relasi ke header |
| barangId | relasi ke Barang |
| namaBarangSnapshot, satuanSnapshot | disalin saat input, supaya laporan histori tidak berubah kalau master data diedit belakangan |
| jumlahBarang | qty diminta |
| hargaSatuan | bisa diisi manual atau default dari `hargaReferensi` |
| harga | **computed** = jumlahBarang × hargaSatuan |

> Aturan penting: `harga` dan `totalHpp` selalu dihitung otomatis oleh sistem, tidak pernah diinput manual — mencegah selisih seperti yang rawan terjadi di spreadsheet manual.

## 4. Fitur 1 — Import & Kelola Master Data

- Halaman admin untuk upload file `master-barang` dan `master-unit` (format kolom sama seperti file existing di folder ini).
- Sistem membaca file, menampilkan preview (jumlah baris valid/invalid, kolom yang terbaca), sebelum admin klik "Commit Import".
- Re-import yang sama akan **upsert** berdasarkan `kodeUnit`/`kodeItem` (update data yang berubah, tambah data baru), bukan menduplikasi. Setiap perubahan `hargaReferensi` lewat re-import tercatat ke `BarangHargaHistory` (sumber = `Import`).
- **Edit manual per item**: admin bisa membuka 1 baris master Barang dan mengedit field-nya langsung (termasuk `hargaReferensi`) tanpa perlu re-import seluruh file — untuk mengoreksi kesalahan harga/data secepatnya.
- Setiap kali `hargaReferensi` diedit manual, sistem mencatat baris baru di `BarangHargaHistory` (sumber = `Edit Manual`) berisi harga lama → harga baru, tanggal, dan admin yang mengubah — bisa dilihat sebagai riwayat harga per item.
- Koreksi harga di master Barang **hanya berlaku untuk input permintaan baru ke depannya**; permintaan mingguan yang sudah tersimpan tidak otomatis ikut berubah (lihat Fitur 2 untuk cara mengoreksi baris yang sudah tersimpan).

## 5. Fitur 2 — Input Permintaan Mingguan

- Admin pilih **Unit** → pilih **Minggu** (atau tanggal representatif minggu itu, sesuai pola input sekarang).
- Tambah baris item: cari barang (autocomplete dari master Barang) → satuan otomatis terisi dari master → isi Jumlah Barang → Harga Satuan default dari `hargaReferensi` (bisa diedit manual bila harga aktual berbeda).
- Harga per baris dan Total HPP unit dihitung otomatis & realtime saat mengetik.
- Bisa disimpan sebagai draft, diedit ulang sebelum ditutup, dan dilihat riwayatnya per unit per minggu.
- **Koreksi setelah tersimpan**: admin bisa mengedit `jumlahBarang`/`hargaSatuan` pada baris permintaan yang sudah tersimpan kapan saja (misal karena baris itu awalnya salah ambil harga dari master yang belum dikoreksi) — `harga` & `totalHpp` otomatis dihitung ulang setelah diedit. Edit ini **tidak** menyimpan jejak/histori perubahan (v1) — nilai lama langsung tertimpa nilai baru.

## 6. Fitur 3 — Laporan Cost Unit (fitur utama)

### Filter (semua opsional, bisa dikombinasikan)
| Filter | Pilihan |
|---|---|
| **Periode** | Toggle: **"Pilih Minggu"** (dropdown minggu+tahun, hanya menampilkan minggu yang ada datanya) **ATAU** **"Rentang Tanggal/Tahun"** (date range picker, atau pilih 1 tahun penuh) |
| **Unit** | Multi-select dari master Unit |
| **Item/Barang** | Multi-select/search dari master Barang |
| **Satuan** | Filter berdasarkan `satuanDasar` item |

### Output
- **Tabel ringkasan** — bisa di-toggle grouping per Unit atau per Item, menampilkan **Total Permintaan** (SUM jumlahBarang) dan **Total Harga** (SUM harga) sesuai filter aktif.
- **Tabel detail** — baris transaksi yang cocok dengan filter: Tanggal/Minggu, Unit, Nama Barang, Satuan, Jumlah, Harga Satuan, Harga.
- **Grand total** di baris/footer terakhir.
- Tombol **Export Excel** — menghasilkan file .xlsx berisi data yang sedang ditampilkan (ringkasan + detail), layout final ditentukan saat implementasi (mengikuti pola per-unit block seperti sheet asli, atau tabel rekap standar — lihat Open Questions).

## 7. Tech Stack

| Layer | Pilihan |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Hosting | Vercel |
| Database | Postgres (Neon / Vercel Postgres) |
| ORM | Prisma (pakai *pooled connection string* dari Neon/Vercel Postgres agar aman untuk serverless function) |
| UI | Tailwind CSS + shadcn/ui (table, select, date-range-picker, combobox) |
| Export Excel | `exceljs` |
| Import Excel | `exceljs` / `xlsx` untuk parsing `master-barang`/`master-unit` |
| Auth | Single admin — credential sederhana (NextAuth credentials provider, atau middleware password) |

**Catatan deploy:** Prisma + Postgres bisa dideploy di Vercel tanpa masalah selama pakai *pooled connection string* (disediakan Neon/Vercel Postgres) untuk menghindari exhaust koneksi database saat banyak serverless function jalan bersamaan. `DATABASE_URL` diset sebagai environment variable di Vercel project settings; `prisma generate` berjalan otomatis saat build.

## 8. Acceptance Criteria

- [ ] Admin bisa import master Unit & Barang dari file xlsx (format sama seperti file existing) dan datanya tersimpan benar di database.
- [ ] Admin bisa mengedit langsung 1 item master Barang (termasuk harga) dari UI, dan perubahan harganya tercatat di riwayat (`BarangHargaHistory`) dengan harga lama, harga baru, tanggal, dan pengubah.
- [ ] Admin bisa input permintaan mingguan per unit; harga baris & total HPP unit terhitung otomatis dan benar.
- [ ] Admin bisa mengedit baris permintaan yang sudah tersimpan (misal untuk mengoreksi harga yang salah), dan `harga`/`totalHpp` ikut terhitung ulang otomatis.
- [ ] Laporan bisa difilter dengan kombinasi: minggu **atau** rentang tanggal/tahun + unit + item + satuan, dan Total Permintaan & Total Harga yang tampil sudah benar (divalidasi manual terhadap minimal 1 contoh minggu nyata).
- [ ] Export Excel menghasilkan file yang bisa dibuka di Excel dan datanya identik dengan yang tampil di laporan web.

## 9. Open Questions

Perlu didiskusikan/diputuskan di awal implementasi:
1. **Definisi "minggu"** — ISO week (Senin–Minggu) atau minggu kustom rumah sakit (misal Sabtu–Jumat)?
2. **Multiplicity submission** — 1 unit hanya boleh 1 submission per minggu (replace bila diinput ulang) atau boleh lebih dari satu (akumulasi)?
3. **Layout export Excel** — mengikuti format asli per-unit block (seperti sheet sekarang) atau format tabel rekap + detail standar?

## 10. Next Steps

Setelah PRD ini disetujui:
1. Scaffold project Next.js + setup Prisma schema sesuai Data Model di atas.
2. Setup database (Neon/Vercel Postgres) & environment variable di Vercel.
3. Implementasi Fitur 1 (Import Master Data) — jalankan dulu dengan 2 file xlsx yang sudah ada sebagai data awal.
4. Implementasi Fitur 2 (Input Permintaan Mingguan).
5. Implementasi Fitur 3 (Laporan Cost Unit + Export Excel).
6. Deploy ke Vercel & uji end-to-end dengan data minggu nyata.
