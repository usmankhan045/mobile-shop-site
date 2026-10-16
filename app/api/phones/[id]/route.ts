import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

const MAX_MONEY = 9999999999.99;
const isDateKey = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return date.getUTCFullYear() === Number(value.slice(0, 4)) && date.getUTCMonth() + 1 === Number(value.slice(5, 7)) && date.getUTCDate() === Number(value.slice(8, 10));
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!await getCurrentAdmin()) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const rows = await getDb()`SELECT * FROM phone_history WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) return NextResponse.json({ error: "Phone not found." }, { status: 404 });
  const events = await getDb()`SELECT * FROM phone_events WHERE phone_id = ${id} ORDER BY event_date DESC, created_at DESC`;
  return NextResponse.json({ phone: rows[0], events });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const sql = getDb();
    const body = await request.json();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
    if (body.action === "return") {
      const returnedAt = String(body.returnedAt || today);
      if (!isDateKey(returnedAt)) return NextResponse.json({ error: "Return date must be a valid YYYY-MM-DD date." }, { status: 400 });
      const rows = await sql`WITH event AS (
        INSERT INTO phone_events (phone_id, event_type, amount, event_date, metadata, created_by)
        SELECT id, 'return', sale_price, ${returnedAt}, ${JSON.stringify({ reason: body.reason || "Customer return" })}, ${admin.id}
        FROM phones WHERE id = ${id} AND status = 'Sold' RETURNING phone_id
      ), updated AS (
        UPDATE phones SET sale_price = NULL, sold_at = NULL, status = 'Returned', customer_id = NULL, updated_at = now()
        WHERE id IN (SELECT phone_id FROM event) RETURNING *
      ) SELECT * FROM updated`;
      if (!rows[0]) return NextResponse.json({ error: "Only sold phones can be returned." }, { status: 409 });
      return NextResponse.json({ phone: rows[0] });
    }
    if (body.action !== "sell") return NextResponse.json({ error: "Unsupported phone action." }, { status: 400 });
    const salePrice = Number(body.salePrice);
    if (!Number.isFinite(salePrice) || salePrice <= 0 || salePrice > MAX_MONEY) return NextResponse.json({ error: "A valid sale price is required." }, { status: 400 });
    const saleDate = String(body.soldAt || today);
    if (!isDateKey(saleDate)) return NextResponse.json({ error: "Sale date must be a valid YYYY-MM-DD date." }, { status: 400 });
    const rows = await sql`WITH new_customer AS (
      INSERT INTO customers (name, phone)
      SELECT ${body.customer || "Walk-in customer"}, ${body.customerPhone || null}
      WHERE ${Boolean(body.customer)}
      RETURNING id
    ), updated AS (
      UPDATE phones
      SET sale_price = ${salePrice}, sold_at = ${saleDate}, status = 'Sold', customer_id = (SELECT id FROM new_customer), updated_at = now()
      WHERE id = ${id} AND status IN ('In stock', 'Returned')
      RETURNING *
    ), event AS (
      INSERT INTO phone_events (phone_id, event_type, amount, event_date, metadata, created_by)
      SELECT id, 'sale', sale_price, ${saleDate}, ${JSON.stringify({ customer: body.customer || "Walk-in customer" })}, ${admin.id}
      FROM updated
      RETURNING phone_id
    ) SELECT * FROM updated`;
    if (!rows[0]) return NextResponse.json({ error: "Phone is not available for sale." }, { status: 409 });
    return NextResponse.json({ phone: rows[0] });
  } catch (error) {
    console.error("sale failed", error);
    return NextResponse.json({ error: "Unable to complete sale." }, { status: 500 });
  }
}
