import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { appUrl, emailConfigured, sendEmail } from "@/lib/email";
import { issueAuthToken } from "@/lib/tokens";

const genericResponse = () => NextResponse.json({ message: "If a verified recovery email exists, a reset link has been sent." });

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return genericResponse();
    const rows = await getDb()`SELECT id, email FROM admins WHERE email = ${normalizedEmail} AND email_verified_at IS NOT NULL LIMIT 1`;
    if (!rows.length || !emailConfigured()) return genericResponse();
    const token = await issueAuthToken(rows[0].id as string, "password_reset", 15);
    await sendEmail({ to: normalizedEmail, subject: "Reset your Ledgerline password", html: `<p>We received a request to reset your Ledgerline password.</p><p><a href="${appUrl()}/reset-password?token=${token}">Reset password</a></p><p>This link expires in 15 minutes and can be used once.</p><p>If you did not request this, you can ignore this email.</p>` });
    return genericResponse();
  } catch (error) {
    console.error("password reset request failed", error);
    return genericResponse();
  }
}
