import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "./db";

const COOKIE_NAME = "ledgerline_session";
const SESSION_DAYS = 14;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(adminId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const sql = getDb();
  await sql`INSERT INTO sessions (admin_id, token_hash, expires_at) VALUES (${adminId}, ${hashToken(token)}, ${expiresAt.toISOString()})`;
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", expires: expiresAt, path: "/" });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token && process.env.DATABASE_URL) await getDb()`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentAdmin() {
  if (!process.env.DATABASE_URL) return null;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const rows = await getDb()`SELECT a.id, a.name, a.email FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > now() LIMIT 1`;
  return rows[0] ?? null;
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("UNAUTHORIZED");
  return admin;
}
