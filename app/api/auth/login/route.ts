import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { createSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    const normalizedUsername = String(username ?? "").trim().toLowerCase();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const sql = getDb();
    const recentAttempts = await sql`SELECT COUNT(*)::int AS count FROM login_attempts WHERE (email = ${normalizedUsername} OR ip_address = ${ip}) AND succeeded = false AND created_at > now() - interval '15 minutes'`;
    if (Number(recentAttempts[0]?.count ?? 0) >= 8) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
    const rows = await sql`SELECT id, name, username, password_hash FROM admins WHERE username = ${normalizedUsername} LIMIT 1`;
    const passwordHash = rows[0]?.password_hash as string | undefined;
    const valid = passwordHash ? await bcrypt.compare(String(password ?? ""), passwordHash) : false;
    await sql`INSERT INTO login_attempts (email, ip_address, succeeded) VALUES (${normalizedUsername || "unknown"}, ${ip}, ${Boolean(rows[0] && valid)})`;
    if (!rows[0] || !valid) return NextResponse.json({ error: "Username or password is incorrect." }, { status: 401 });
    await sql`DELETE FROM login_attempts WHERE (email = ${normalizedUsername} OR ip_address = ${ip}) AND succeeded = false`;
    await createSession(rows[0].id as string);
    return NextResponse.json({ admin: { id: rows[0].id, name: rows[0].name, username: rows[0].username } });
  } catch (error) {
    console.error("login failed", error);
    return NextResponse.json({ error: "Unable to sign in." }, { status: 500 });
  }
}
