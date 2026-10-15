import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { createSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { name, username, password } = await request.json();
    const normalizedUsername = String(username ?? "").trim().toLowerCase();
    if (!String(name ?? "").trim() || !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalizedUsername) || typeof password !== "string" || password.length < 8) return NextResponse.json({ error: "Name, username, and an 8-character password are required." }, { status: 400 });
    const sql = getDb();
    const existing = await sql`SELECT id FROM admins LIMIT 1`;
    if (existing.length) return NextResponse.json({ error: "Admin setup is already complete." }, { status: 409 });
    const passwordHash = await bcrypt.hash(password, 12);
    const rows = await sql`INSERT INTO admins (name, username, email, password_hash) VALUES (${name.trim()}, ${normalizedUsername}, ${`${normalizedUsername}@local.invalid`}, ${passwordHash}) RETURNING id, name, username`;
    await createSession(rows[0].id as string);
    return NextResponse.json({ admin: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("admin setup failed", error);
    return NextResponse.json({ error: "Unable to complete setup." }, { status: 500 });
  }
}
