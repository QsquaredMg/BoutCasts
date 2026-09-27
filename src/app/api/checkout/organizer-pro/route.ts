import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { ORGANIZER_PRO } from "@/lib/liveVoteEvents/tiers";

// Start an Organizer Pro monthly subscription. The webhook records it in
// organizer_subscriptions once Stripe confirms.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from("organizer_subscriptions")
    .select("status, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();
  if (
    existing &&
    ["active", "trialing", "past_due"].includes(existing.status) &&
    (!existing.current_period_end || new Date(existing.current_period_end) > new Date())
  ) {
    return NextResponse.json({ error: "You already have Organizer Pro — manage it from Billing." }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: user.email ?? undefined,
    client_reference_id: user.id,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "BoutCasts Organizer Pro",
            description: `Pro analytics on every Live Vote + ${ORGANIZER_PRO.includedEventsPerPeriod} Small or Medium events included each month`,
          },
          unit_amount: ORGANIZER_PRO.priceCents,
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    subscription_data: { metadata: { kind: "organizer_pro", user_id: user.id } },
    success_url: `${origin}/live-vote?plan=success`,
    cancel_url: `${origin}/live-vote?plan=cancelled`,
    metadata: { kind: "organizer_pro", user_id: user.id },
  });

  return NextResponse.json({ url: session.url });
}
