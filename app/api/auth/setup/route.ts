import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { appUrl, emailConfigured, sendEmail } from "@/lib/email";
import { issueAuthToken } from "@/lib/tokens";

export async function POST(request: NextRequest) {
  try {
    const { name, username, email, password } = await request.json();
    const normalizedUsername = String(username ?? "").trim().toLowerCase();
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    if (!String(name ?? "").trim() || !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalizedUsername) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || typeof password !== "string" || password.length < 8) return NextResponse.json({ error: "Name, username, recovery email, and an 8-character password are required." }, { status: 400 });
    if (!emailConfigured()) return NextResponse.json({ error: "Email delivery is not configured. Add RESEND_API_KEY, EMAIL_FROM, and APP_URL first." }, { status: 503 });
    const sql = getDb();
    const existing = await sql`SELECT id FROM admins LIMIT 1`;
    if (existing.length) return NextResponse.json({ error: "Admin setup is already complete." }, { status: 409 });
    const passwordHash = await bcrypt.hash(password, 12);
    const rows = await sql`INSERT INTO admins (name, username, email, password_hash) VALUES (${name.trim()}, ${normalizedUsername}, ${normalizedEmail}, ${passwordHash}) RETURNING id, name, username, email`;
    try {
      const token = await issueAuthToken(rows[0].id as string, "email_verification", 30);
      await sendEmail({ to: normalizedEmail, subject: "Verify your Ledgerline recovery email", html: `<p>Verify the recovery email for your Ledgerline shop account.</p><p><a href="${appUrl()}/verify-email?token=${token}">Verify recovery email</a></p><p>This link expires in 30 minutes.</p>` });
    } catch (error) {
      await sql`DELETE FROM admins WHERE id = ${rows[0].id}`;
      throw error;
    }
    await createSession(rows[0].id as string);
    return NextResponse.json({ admin: rows[0], message: "Account created. Verify your recovery email from the link we sent." }, { status: 201 });
  } catch (error) {
    console.error("admin setup failed", error);
    return NextResponse.json({ error: "Unable to complete setup." }, { status: 500 });
  }
}
