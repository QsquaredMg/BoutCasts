import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { requireAdmin } from "@/lib/adminGuard";

export const runtime = "nodejs";

// Admin-only: a one-off Stripe Checkout link at a price you choose (24 hours). Send it to the buyer.
// Upgrade products still apply automatically after payment, exactly like a normal purchase.
const PRODUCTS: Record<string, { label: string; needs: "event" | "bracket" | null; kind: string }> = {
  custom: { label: "Custom payment", needs: null, kind: "admin_custom" },
  live_vote_pro: { label: "Live Vote Pro upgrade", needs: "event", kind: "live_vote_pro" },
  super_votes_unlock: { label: "Super Votes unlock", needs: "event", kind: "super_votes_unlock" },
  time_addon: { label: "Live Vote extra time", needs: "event", kind: "time_addon" },
  pred_bracket_upgrade: { label: "Prediction game upgrade", needs: "bracket", kind: "pred_bracket_upgrade" },
};

export async function POST(req: Request) {
  const g = await requireAdmin();
  if ("response" in g) return g.response;
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Stripe is not set up." }, { status: 501 });

  const b = (await req.json().catch(() => null)) as {
    product?: string;
    targetId?: string;
    days?: number;
    amountCents?: number;
    description?: string;
    buyerEmail?: string;
  } | null;
  const p = b?.product ? PRODUCTS[b.product] : undefined;
  if (!p) return NextResponse.json({ error: "Choose what is being sold." }, { status: 400 });
  const amount = Math.round(Number(b?.amountCents));
  if (!Number.isFinite(amount) || amount < 50) return NextResponse.json({ error: "Price must be at least $0.50." }, { status: 400 });
  const description = (b?.description ?? "").trim().slice(0, 120) || p.label;
  const email = (b?.buyerEmail ?? "").trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Buyer email looks wrong." }, { status: 400 });

  const metadata: Record<string, string> = { kind: p.kind, created_by: g.email, source: "boutcasts_admin_link" };
  if (p.needs) {
    if (!b?.targetId || !/^[0-9a-f-]{36}$/i.test(b.targetId)) return NextResponse.json({ error: `Paste the ${p.needs} ID.` }, { status: 400 });
    metadata[p.needs === "event" ? "event_id" : "bracket_id"] = b.targetId;
  }
  if (p.kind === "time_addon") {
    const days = Number(b?.days);
    if (!Number.isInteger(days) || days < 1 || days > 14) return NextResponse.json({ error: "Choose 1 to 14 days." }, { status: 400 });
    metadata.days = String(days);
  }

  const origin = new URL(req.url).origin;
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "cashapp"],
      allow_promotion_codes: true,
      customer_email: email || undefined,
      line_items: [{ quantity: 1, price_data: { currency: "usd", product_data: { name: description }, unit_amount: amount } }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + 23 * 3600,
      metadata,
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    console.error("admin payment link failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Stripe could not create the link." }, { status: 502 });
  }
}
