import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL belum diset. Lihat .env.example.");
}

// Prisma 7 wajib pakai driver adapter. Pakai connection string "pooled"
// dari Neon/Vercel Postgres agar aman dipakai di serverless function Vercel.
const adapter = new PrismaPg(connectionString);

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

function isTransientConnectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Can't reach database server") ||
    message.includes("Server has closed the connection") ||
    message.includes("Connection terminated")
  );
}

// Database serverless (mis. Prisma Postgres) kadang "cold start" - koneksi
// pertama setelah idle bisa gagal sesaat lalu langsung normal di percobaan
// berikutnya. Retry sekali supaya user tidak lihat error untuk kasus ini.
export const prisma = basePrisma.$extends({
  query: {
    async $allOperations({ args, query }) {
      try {
        return await query(args);
      } catch (error) {
        if (!isTransientConnectionError(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 400));
        return await query(args);
      }
    },
  },
});
