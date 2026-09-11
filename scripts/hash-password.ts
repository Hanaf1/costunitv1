import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error("Pakai: npx tsx scripts/hash-password.ts <password>");
  process.exit(1);
}

bcrypt.hash(password, 10).then((hash) => {
  // Next.js meng-expand "$VAR" di file .env, jadi setiap "$" di hash bcrypt
  // harus di-escape jadi "\$" supaya tidak rusak saat dibaca sebagai env var.
  const escaped = hash.replaceAll("$", "\\$");
  console.log("Hash asli (untuk referensi):", hash);
  console.log("");
  console.log("Copy baris ini ke .env:");
  console.log(`ADMIN_PASSWORD_HASH="${escaped}"`);
});
