import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_COOKIE = "cu_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 jam

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET belum diset di environment variable.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(username: string): Promise<string> {
  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(username: string) {
  const token = await createSessionToken(username);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionUsername(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// Dipanggil di setiap Server Action / data access yang butuh admin login.
// Proxy (src/proxy.ts) sudah melakukan optimistic redirect, tapi setiap
// Server Action tetap wajib verifikasi sendiri (lihat guide keamanan Next.js).
export async function requireSession(): Promise<string> {
  const username = await getSessionUsername();
  if (!username) {
    redirect("/login");
  }
  return username;
}

export { SESSION_COOKIE };
