import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { requireAdmin } from "@/lib/adminGuard";

export const runtime = "nodejs";

// Admin-only: promo codes that buyers type in at Stripe Checkout to get a discount.
export async function GET() {
  const g = await requireAdmin();
  if ("response" in g) return g.response;
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Stripe is not set up." }, { status: 501 });
  const list = await getStripe().promotionCodes.list({ limit: 50, expand: ["data.promotion.coupon"] });
  const codes = list.data.map((p) => {
    const c = p.promotion?.coupon && typeof p.promotion.coupon !== "string" ? p.promotion.coupon : null;
    return {
      id: p.id,
      code: p.code,
      active: p.active,
      percentOff: c?.percent_off ?? null,
      amountOffCents: c?.amount_off ?? null,
      timesRedeemed: p.times_redeemed,
      maxRedemptions: p.max_redemptions,
      expiresAt: p.expires_at,
    };
  });
  return NextResponse.json({ codes });
}

export async function POST(req: Request) {
  const g = await requireAdmin();
  if ("response" in g) return g.response;
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Stripe is not set up." }, { status: 501 });
  const b = (await req.json().catch(() => null)) as {
    action?: string;
    id?: string;
    code?: string;
    percentOff?: number;
    amountOffCents?: number;
    maxRedemptions?: number;
    expiresAt?: string;
  } | null;
  const stripe = getStripe();

  if (b?.action === "deactivate") {
    if (!b.id || !/^promo_[A-Za-z0-9]+$/.test(b.id)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
    await stripe.promotionCodes.update(b.id, { active: false });
    return NextResponse.json({ ok: true });
  }

  const code = (b?.code ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return NextResponse.json({ error: "Code must be 3 to 30 letters, numbers, - or _." }, { status: 400 });
  const pct = b?.percentOff ? Number(b.percentOff) : null;
  const amt = b?.amountOffCents ? Math.round(Number(b.amountOffCents)) : null;
  if ((pct == null) === (amt == null)) return NextResponse.json({ error: "Enter either a percent off or a dollar amount off." }, { status: 400 });
  if (pct != null && !(pct > 0 && pct <= 100)) return NextResponse.json({ error: "Percent off must be between 1 and 100." }, { status: 400 });
  if (amt != null && !(amt >= 50)) return NextResponse.json({ error: "Dollar amount off must be at least $0.50." }, { status: 400 });
  const max = b?.maxRedemptions ? Math.round(Number(b.maxRedemptions)) : undefined;
  if (max != null && !(max >= 1)) return NextResponse.json({ error: "Limit must be 1 or more." }, { status: 400 });
  const expires = b?.expiresAt ? Math.floor(new Date(b.expiresAt).getTime() / 1000) : undefined;
  if (expires != null && !(expires > Date.now() / 1000)) return NextResponse.json({ error: "Expiry must be in the future." }, { status: 400 });

  try {
    const coupon = await stripe.coupons.create({
      ...(pct != null ? { percent_off: pct } : { amount_off: amt!, currency: "usd" }),
      duration: "once",
      name: code,
      metadata: { created_by: g.email, source: "boutcasts_admin" },
    });
    await stripe.promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id },
      code,
      ...(max ? { max_redemptions: max } : {}),
      ...(expires ? { expires_at: expires } : {}),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    console.error("admin promo create failed", msg);
    return NextResponse.json({ error: /already exists/i.test(msg) ? "That code already exists." : "Stripe could not create the code." }, { status: 502 });
  }
}
