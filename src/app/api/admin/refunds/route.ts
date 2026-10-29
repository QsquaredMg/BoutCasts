import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";

export const runtime = "nodejs";

// Admin-only: refund a one-time purchase, in full or in part, through Stripe.
// A refund returns the money only. It does not undo what the buyer received (a live event stays live,
// a game stays open), so remove or archive that item from its Admin page if it should go too.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { data: prof } = await supabase.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle();
  if (!prof?.is_admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Stripe is not set up." }, { status: 501 });

  const body = (await req.json().catch(() => null)) as { paymentIntentId?: string; amountCents?: number } | null;
  const pi = body?.paymentIntentId;
  if (!pi || !/^pi_[A-Za-z0-9_]+$/.test(pi)) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const stripe = getStripe();
  try {
    const intent = await stripe.paymentIntents.retrieve(pi, { expand: ["latest_charge"] });
    const charge = intent.latest_charge && typeof intent.latest_charge !== "string" ? intent.latest_charge : null;
    if (!charge) return NextResponse.json({ error: "No payment found to refund." }, { status: 404 });
    const remaining = charge.amount - charge.amount_refunded;
    if (remaining <= 0) return NextResponse.json({ error: "This payment is already fully refunded." }, { status: 409 });

    const wanted = body?.amountCents == null ? remaining : Math.round(Number(body.amountCents));
    if (!Number.isFinite(wanted) || wanted <= 0 || wanted > remaining) {
      return NextResponse.json({ error: `Enter an amount between $0.01 and $${(remaining / 100).toFixed(2)}.` }, { status: 400 });
    }
    const refund = await stripe.refunds.create(
      {
        payment_intent: pi,
        amount: wanted,
        reason: "requested_by_customer",
        metadata: { refunded_by: u.user.email ?? u.user.id, source: "boutcasts_admin" },
      },
      // A double click or retry with the same amount against the same balance is one refund, not two.
      { idempotencyKey: `admin-refund-${pi}-${charge.amount_refunded}-${wanted}` },
    );
    return NextResponse.json({ ok: true, refundedCents: refund.amount, status: refund.status });
  } catch (e) {
    console.error("admin refund failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Stripe could not refund this payment. Check it in the Stripe dashboard." }, { status: 502 });
  }
}
