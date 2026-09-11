import "dotenv/config";
import { defineConfig, env } from "@prisma/config";

// Prisma 7: konfigurasi datasource untuk keperluan CLI (migrate/studio/seed)
// dipisah dari schema.prisma. Koneksi runtime PrismaClient tetap diatur lewat
// driver adapter di src/lib/prisma.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
