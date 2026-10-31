import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/adminGuard";

export const runtime = "nodejs";

// Admin-only: record a sale taken outside Stripe (cash, check, Venmo) or a free grant, so it shows in
// Purchases and the weekly total. This only keeps the record; it does not switch anything on. To turn on a
// Live Vote event or school election, use that item's own Admin page (it has a free "Go live" button).
const METHODS = ["Cash", "Check", "Venmo", "Zelle", "Cash App", "PayPal", "Invoice", "Other"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Body = {
  action?: string;
  id?: string;
  clientId?: string;
  kind?: string;
  what?: string;
  amountCents?: number;
  method?: string;
  buyerName?: string;
  buyerEmail?: string;
  note?: string;
  soldOn?: string;
};

const clean = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function POST(req: Request) {
  const g = await requireAdmin();
  if ("response" in g) return g.response;
  const b = (await req.json().catch(() => null)) as Body | null;
  if (!b) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const db = createAdminClient();

  if (b.action === "void") {
    if (!b.id || !UUID.test(b.id)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
    const { data, error } = await db
      .from("manual_sales")
      .update({ voided_at: new Date().toISOString(), voided_by: g.email })
      .eq("id", b.id)
      .is("voided_at", null)
      .select("id")
      .maybeSingle();
    if (error) return fail(error, "void");
    if (!data) return NextResponse.json({ error: "That entry was already removed." }, { status: 409 });
    console.log("admin manual sale voided", { by: g.email, id: b.id });
    return NextResponse.json({ ok: true });
  }

  const kind = b.kind === "comp" ? "comp" : b.kind === "offline" ? "offline" : null;
  const what = clean(b.what, 120);
  if (!kind || !what) return NextResponse.json({ error: "Say what was sold." }, { status: 400 });
  let amountCents = 0;
  if (kind === "offline") {
    amountCents = Math.round(Number(b.amountCents));
    if (!Number.isFinite(amountCents) || amountCents < 1 || amountCents > 10_000_000) {
      return NextResponse.json({ error: "Enter the amount received, up to $100,000." }, { status: 400 });
    }
  }
  const email = clean(b.buyerEmail, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
  const method = kind === "offline" ? (b.method && METHODS.includes(b.method) ? b.method : "Other") : null;
  if (b.clientId && !UUID.test(b.clientId)) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  let soldAt = new Date();
  if (b.soldOn) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.soldOn)) return NextResponse.json({ error: "Bad date." }, { status: 400 });
    // Noon UTC keeps the date the same in every US time zone.
    const d = new Date(`${b.soldOn}T12:00:00Z`);
    const now = Date.now();
    if (Number.isNaN(d.getTime()) || d.getTime() > now + 86_400_000 || d.getTime() < now - 400 * 86_400_000) {
      return NextResponse.json({ error: "Pick a date within the last year, not in the future." }, { status: 400 });
    }
    soldAt = d;
  }

  const { error } = await db.from("manual_sales").insert({
    client_id: b.clientId ?? null,
    sold_at: soldAt.toISOString(),
    kind,
    what,
    amount_cents: amountCents,
    method,
    buyer_name: clean(b.buyerName, 120),
    buyer_email: email,
    note: clean(b.note, 500),
    recorded_by: g.email,
  });
  // The same form submitted twice (same clientId) is saved once.
  if (error && error.code !== "23505") return fail(error, "record");
  console.log("admin manual sale recorded", { by: g.email, kind, what, amountCents });
  return NextResponse.json({ ok: true });
}

function fail(e: { message: string; code?: string }, what: string) {
  console.error(`admin manual sale ${what} failed`, e.message);
  if (e.code === "42P01") {
    return NextResponse.json({ error: "The sales table isn't set up yet. Run docs/sql/manual_sales.sql in the Supabase SQL editor." }, { status: 501 });
  }
  return NextResponse.json({ error: "Could not save that." }, { status: 500 });
}
