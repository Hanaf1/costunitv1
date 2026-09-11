# Cost Unit Report

Aplikasi input Permintaan Mingguan per unit + Laporan Cost Unit (filter minggu/rentang tanggal,
unit, item, satuan; total permintaan & total harga; export Excel). Lihat spesifikasi lengkap di
[PRD-cost-unit-report.md](./PRD-cost-unit-report.md).

Stack: Next.js (App Router) + Prisma 7 (driver adapter `@prisma/adapter-pg`) + PostgreSQL
(Neon / Vercel Postgres) + Tailwind. Deploy target: Vercel.

## Menjalankan di lokal

### 1. Siapkan database Postgres (Neon)

1. Buat akun gratis di [neon.tech](https://neon.tech) (atau lewat tab **Storage** di project Vercel
   kamu, pilih Postgres - ini otomatis provisioning Neon juga).
2. Buat project + database baru.
3. Salin **pooled connection string**-nya (biasanya ada opsi "Pooled connection" di dashboard Neon).

### 2. Isi environment variable

Copy `.env.example` ke `.env`, lalu isi:

```bash
DATABASE_URL="postgresql://...connection-string-dari-neon...?sslmode=require"
SESSION_SECRET="$(openssl rand -base64 32)"   # atau generate manual, string random panjang
ADMIN_USERNAME="admin"
ADMIN_PASSWORD_HASH="<hasil dari langkah di bawah>"
```

Generate hash password admin:

```bash
npx tsx scripts/hash-password.ts "password-pilihan-kamu"
```

Salin hasilnya ke `ADMIN_PASSWORD_HASH`.

### 3. Install dependencies, migrate, seed

```bash
npm install
npx prisma migrate dev --name init   # membuat tabel di database Neon
npm run db:seed                      # import master-unit-*.xlsx & master-barang-*.xlsx yang ada di root
```

### 4. Jalankan

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000), lalu login dengan `ADMIN_USERNAME` +
password yang kamu pilih di langkah 2.

## Struktur fitur

- `/master-data/unit`, `/master-data/barang` - lihat & edit master data (termasuk riwayat
  perubahan harga barang).
- `/master-data/import` - import ulang master data dari file `.xlsx`.
- `/permintaan` - input & kelola permintaan mingguan per unit.
- `/laporan` - laporan Cost Unit dengan filter + export Excel (`/api/laporan/export`).

## Deploy ke Vercel

1. Push repo ini ke GitHub, import di [vercel.com/new](https://vercel.com/new).
2. Di project Vercel, buka tab **Storage** → tambahkan **Postgres** (Neon) jika belum, atau
   sambungkan ke database Neon yang sudah dipakai di lokal.
3. Set environment variables yang sama seperti `.env` (`DATABASE_URL` pakai pooled connection
   string, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`) di Vercel project settings.
4. Deploy. `prisma generate` berjalan otomatis lewat `postinstall`/build Next.js.

## Catatan

- `npm audit` melaporkan beberapa vulnerability level medium/high di dependency transitive
  (`deepmerge-ts`/`mysql2` lewat Prisma CLI, `uuid` lewat `exceljs`) yang hanya dipakai jalur
  tooling CLI/internal, bukan jalur yang menerima input dari luar aplikasi ini. Sudah dicek dan
  diputuskan aman untuk saat ini; pantau update dari Prisma/ExcelJS ke depannya.
