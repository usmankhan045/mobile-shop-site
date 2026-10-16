import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

const MAX_MONEY = 9999999999.99;
const isDateKey = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return date.getUTCFullYear() === Number(value.slice(0, 4)) && date.getUTCMonth() + 1 === Number(value.slice(5, 7)) && date.getUTCDate() === Number(value.slice(8, 10));
};

export async function GET() {
  try {
    if (!await getCurrentAdmin()) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const rows = await getDb()`SELECT id, model, supplier_name, quantity, unit_cost, quantity * unit_cost AS total_cost, to_char(purchased_at, 'YYYY-MM-DD') AS purchased_at, notes, created_at FROM bulk_purchases ORDER BY purchased_at DESC, created_at DESC LIMIT 500`;
    return NextResponse.json({ bulkPurchases: rows });
  } catch (error) {
    console.error("bulk purchases fetch failed", error);
    return NextResponse.json({ error: "Unable to load bulk purchases." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const body = await request.json();
    const model = String(body.model ?? "").trim();
    const supplierName = String(body.supplierName ?? "").trim();
    const quantity = Number(body.quantity);
    const unitCost = Number(body.unitCost);
    const purchasedAt = String(body.purchasedAt || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date()));
    if (!model || !supplierName || !Number.isInteger(quantity) || quantity <= 0 || quantity > 1000000 || !Number.isFinite(unitCost) || unitCost <= 0 || unitCost > MAX_MONEY || quantity * unitCost > MAX_MONEY) return NextResponse.json({ error: "Model, supplier, quantity, and a valid unit cost are required." }, { status: 400 });
    if (!isDateKey(purchasedAt)) return NextResponse.json({ error: "Purchase date must be a valid YYYY-MM-DD date." }, { status: 400 });
    const sql = getDb();
    const rows = await sql`WITH inserted_purchase AS (
      INSERT INTO bulk_purchases (model, supplier_name, quantity, unit_cost, purchased_at, notes, created_by)
      VALUES (${model}, ${supplierName}, ${quantity}, ${unitCost}, ${purchasedAt}, ${body.notes ? String(body.notes).trim() : null}, ${admin.id})
      RETURNING id, model, supplier_name, quantity, unit_cost, quantity * unit_cost AS total_cost, to_char(purchased_at, 'YYYY-MM-DD') AS purchased_at, notes, created_at
    ), inserted_event AS (
      INSERT INTO bulk_purchase_events (bulk_purchase_id, event_type, amount, quantity, event_date, metadata, created_by)
      SELECT id, 'purchase', quantity * unit_cost, quantity, ${purchasedAt}, ${JSON.stringify({ model, supplierName })}, ${admin.id}
      FROM inserted_purchase
    ) SELECT * FROM inserted_purchase`;
    return NextResponse.json({ bulkPurchase: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("bulk purchase failed", error);
    return NextResponse.json({ error: "Unable to save bulk purchase." }, { status: 500 });
  }
}
