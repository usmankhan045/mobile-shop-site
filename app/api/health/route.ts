import { NextResponse } from "next/server";
import { databaseConfigured, getDb } from "@/lib/db";

export async function GET() {
  if (!databaseConfigured()) return NextResponse.json({ ok: true, database: "not-configured", mode: "demo" });
  try {
    await getDb()`SELECT 1`;
    return NextResponse.json({ ok: true, database: "connected", mode: "live" });
  } catch {
    return NextResponse.json({ ok: false, database: "error" }, { status: 503 });
  }
}
