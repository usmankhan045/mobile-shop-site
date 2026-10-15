import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { appUrl, sendEmail } from "@/lib/email";
import { issueAuthToken } from "@/lib/tokens";

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "You are not signed in." }, { status: 401 });
  try {
    const { email, password } = await request.json();
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || typeof password !== "string") return NextResponse.json({ error: "Enter a valid email and your current password." }, { status: 400 });
    const sql = getDb();
    const current = await sql`SELECT password_hash, email, email_verified_at FROM admins WHERE id = ${admin.id} LIMIT 1`;
    const valid = current[0]?.password_hash ? await bcrypt.compare(password, current[0].password_hash as string) : false;
    if (!valid) return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    const duplicate = await sql`SELECT id FROM admins WHERE email = ${normalizedEmail} AND id <> ${admin.id} LIMIT 1`;
    if (duplicate.length) return NextResponse.json({ error: "That recovery email is already in use." }, { status: 409 });
    const oldEmail = current[0].email as string;
    const oldVerifiedAt = current[0].email_verified_at;
    await sql`UPDATE admins SET email = ${normalizedEmail}, email_verified_at = NULL, updated_at = now() WHERE id = ${admin.id}`;
    try {
      const token = await issueAuthToken(admin.id as string, "email_verification", 30);
      await sendEmail({ to: normalizedEmail, subject: "Verify your Ledgerline recovery email", html: `<p>Verify the recovery email for your Ledgerline shop account.</p><p><a href="${appUrl()}/verify-email?token=${token}">Verify recovery email</a></p><p>This link expires in 30 minutes.</p>` });
    } catch (error) {
      await sql`UPDATE admins SET email = ${oldEmail}, email_verified_at = ${oldVerifiedAt}, updated_at = now() WHERE id = ${admin.id}`;
      throw error;
    }
    return NextResponse.json({ message: "Verification link sent. Check the new recovery email.", email: normalizedEmail, emailVerifiedAt: null });
  } catch (error) {
    console.error("recovery email update failed", error);
    return NextResponse.json({ error: "Unable to send the verification email. Check email configuration and try again." }, { status: 503 });
  }
}
