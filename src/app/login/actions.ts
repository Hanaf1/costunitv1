"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { setSessionCookie } from "@/lib/auth";

export type LoginState = { error?: string } | undefined;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/laporan");

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!adminUsername || !adminPasswordHash) {
    return { error: "Konfigurasi admin belum diset di server (ADMIN_USERNAME/ADMIN_PASSWORD_HASH)." };
  }

  if (username !== adminUsername) {
    return { error: "Username atau password salah." };
  }

  const valid = await bcrypt.compare(password, adminPasswordHash);
  if (!valid) {
    return { error: "Username atau password salah." };
  }

  await setSessionCookie(username);
  redirect(next.startsWith("/") ? next : "/laporan");
}
