import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { consumeAuthToken } from "@/lib/tokens";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    if (typeof token !== "string" || token.length < 32) return NextResponse.json({ error: "This verification link is invalid." }, { status: 400 });
    const adminId = await consumeAuthToken(token, "email_verification");
    if (!adminId) return NextResponse.json({ error: "This verification link is invalid or has expired." }, { status: 410 });
    const rows = await getDb()`UPDATE admins SET email_verified_at = now(), updated_at = now() WHERE id = ${adminId} RETURNING id, email, email_verified_at`;
    return NextResponse.json({ admin: rows[0] });
  } catch (error) {
    console.error("email verification failed", error);
    return NextResponse.json({ error: "Unable to verify this email." }, { status: 500 });
  }
}
