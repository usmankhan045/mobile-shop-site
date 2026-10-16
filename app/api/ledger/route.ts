import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/auth";

const isDateKey = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return date.getUTCFullYear() === Number(value.slice(0, 4)) && date.getUTCMonth() + 1 === Number(value.slice(5, 7)) && date.getUTCDate() === Number(value.slice(8, 10));
};

export async function GET(request: NextRequest) {
  try {
    if (!await getCurrentAdmin()) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const url = new URL(request.url);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
    const from = url.searchParams.get("from") || today;
    const to = url.searchParams.get("to") || from;
    if (!isDateKey(from) || !isDateKey(to) || from > to) return NextResponse.json({ error: "Invalid ledger date range." }, { status: 400 });
    const summary = await getDb()`WITH phone_totals AS (
      SELECT COALESCE(SUM(CASE WHEN e.event_type = 'sale' THEN e.amount WHEN e.event_type = 'return' THEN -e.amount ELSE 0 END), 0) AS sales,
        COALESCE(SUM(CASE WHEN e.event_type = 'purchase' THEN e.amount ELSE 0 END), 0) AS purchases,
        COALESCE(SUM(CASE WHEN e.event_type = 'sale' THEN p.purchase_price WHEN e.event_type = 'return' THEN -p.purchase_price ELSE 0 END), 0) AS cost_of_goods,
        COALESCE(SUM(CASE WHEN e.event_type = 'sale' THEN e.amount - p.purchase_price WHEN e.event_type = 'return' THEN -e.amount + p.purchase_price ELSE 0 END), 0) AS gross_profit,
        COALESCE(SUM(CASE WHEN e.event_type = 'sale' THEN 1 WHEN e.event_type = 'return' THEN -1 ELSE 0 END), 0) AS sales_count,
        COALESCE(SUM(CASE WHEN e.event_type = 'purchase' THEN 1 ELSE 0 END), 0) AS purchases_count
      FROM phone_events e JOIN phones p ON p.id = e.phone_id WHERE e.event_date BETWEEN ${from} AND ${to}
    ), bulk_totals AS (
      SELECT COALESCE(SUM(amount), 0) AS purchases, COALESCE(SUM(quantity), 0) AS purchases_count
      FROM bulk_purchase_events WHERE event_type = 'purchase' AND event_date BETWEEN ${from} AND ${to}
    )
    SELECT phone_totals.sales, phone_totals.purchases + bulk_totals.purchases AS purchases, phone_totals.cost_of_goods, phone_totals.gross_profit, phone_totals.sales_count, phone_totals.purchases_count + bulk_totals.purchases_count AS purchases_count FROM phone_totals CROSS JOIN bulk_totals`;
    const transactions = await getDb()`SELECT event_type, amount, event_date, metadata, phone_id FROM phone_events WHERE event_date BETWEEN ${from} AND ${to}
      UNION ALL
      SELECT 'purchase' AS event_type, amount, event_date, metadata || jsonb_build_object('source', 'bulk', 'quantity', quantity), NULL AS phone_id FROM bulk_purchase_events WHERE event_type = 'purchase' AND event_date BETWEEN ${from} AND ${to}
      ORDER BY event_date DESC LIMIT 500`;
    return NextResponse.json({ summary: summary[0], transactions });
  } catch (error) {
    console.error("ledger fetch failed", error);
    return NextResponse.json({ error: "Unable to load ledger." }, { status: 500 });
  }
}
