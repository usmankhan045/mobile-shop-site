import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

const normalizeImei = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const MAX_MONEY = 9999999999.99;
const isDateKey = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return date.getUTCFullYear() === Number(value.slice(0, 4)) && date.getUTCMonth() + 1 === Number(value.slice(5, 7)) && date.getUTCDate() === Number(value.slice(8, 10));
};

export async function GET(request: NextRequest) {
  try {
    if (!await getCurrentAdmin()) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() ?? "";
    const status = url.searchParams.get("status")?.trim() ?? "";
    const rows = await getDb()`SELECT * FROM phone_history WHERE (${query} = '' OR imei ILIKE ${`%${query}%`} OR secondary_imei ILIKE ${`%${query}%`} OR model ILIKE ${`%${query}%`} OR brand ILIKE ${`%${query}%`}) AND (${status} = '' OR status = ${status}) ORDER BY purchased_at DESC, created_at DESC LIMIT 500`;
    return NextResponse.json({ phones: rows });
  } catch (error) {
    console.error("phones fetch failed", error);
    return NextResponse.json({ error: "Unable to load phones." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const body = await request.json();
    const imei = normalizeImei(body.imei);
    const purchasePrice = Number(body.purchasePrice);
    if (imei.length !== 15 || !String(body.model ?? "").trim() || !Number.isFinite(purchasePrice) || purchasePrice <= 0 || purchasePrice > MAX_MONEY) return NextResponse.json({ error: "A valid 15-digit IMEI, model, and purchase price are required." }, { status: 400 });
    const sql = getDb();
    const existing = await sql`SELECT id FROM phones WHERE imei = ${imei} OR secondary_imei = ${imei} LIMIT 1`;
    if (existing.length) return NextResponse.json({ error: "This IMEI already exists." }, { status: 409 });
    const sellerName = body.sellerName ? String(body.sellerName).trim() : null;
    const sellerCnic = body.sellerCnic ? String(body.sellerCnic).trim() : null;
    if (sellerCnic && !/^\d{13}$/.test(sellerCnic)) return NextResponse.json({ error: "Seller CNIC must be exactly 13 digits." }, { status: 400 });
    const purchaseDate = String(body.purchasedAt || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date()));
    if (!isDateKey(purchaseDate)) return NextResponse.json({ error: "Purchase date must be a valid YYYY-MM-DD date." }, { status: 400 });
    const rows = await sql`WITH inserted_phone AS (
      INSERT INTO phones (imei, secondary_imei, brand, model, storage, color, condition, purchase_price, purchased_at, seller_name, seller_cnic, notes, created_by)
      VALUES (${imei}, ${body.secondaryImei || null}, ${body.brand || "Other"}, ${body.model}, ${body.storage || null}, ${body.color || null}, ${body.condition || "Used"}, ${purchasePrice}, ${purchaseDate}, ${sellerName}, ${sellerCnic}, ${body.notes || null}, ${admin?.id ?? null})
      RETURNING *
    ), inserted_event AS (
      INSERT INTO phone_events (phone_id, event_type, amount, event_date, metadata, created_by)
      SELECT id, 'purchase', ${purchasePrice}, ${purchaseDate}, ${JSON.stringify({ sellerName, sellerCnic })}, ${admin?.id ?? null}
      FROM inserted_phone
    ) SELECT * FROM inserted_phone`;
    return NextResponse.json({ phone: rows[0] }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505") return NextResponse.json({ error: "This IMEI already exists." }, { status: 409 });
    console.error("purchase failed", error);
    return NextResponse.json({ error: "Unable to save purchase." }, { status: 500 });
  }
}
