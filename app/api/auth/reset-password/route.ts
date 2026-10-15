import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { consumeAuthToken } from "@/lib/tokens";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();
    if (typeof token !== "string" || token.length < 32 || typeof password !== "string" || password.length < 8) return NextResponse.json({ error: "Use a valid reset link and a password of at least 8 characters." }, { status: 400 });
    const adminId = await consumeAuthToken(token, "password_reset");
    if (!adminId) return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 410 });
    const passwordHash = await bcrypt.hash(password, 12);
    const sql = getDb();
    await sql`UPDATE admins SET password_hash = ${passwordHash}, updated_at = now() WHERE id = ${adminId}`;
    await sql`DELETE FROM sessions WHERE admin_id = ${adminId}`;
    return NextResponse.json({ message: "Password updated. You can sign in now." });
  } catch (error) {
    console.error("password reset failed", error);
    return NextResponse.json({ error: "Unable to reset the password." }, { status: 500 });
  }
}
