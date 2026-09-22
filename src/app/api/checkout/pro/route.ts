import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";

const PRO_PRICE_CENTS = 499;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier, stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.tier === "pro") {
    return NextResponse.json({ error: "Already a BoutCasts Pro member" }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer: profile?.stripe_customer_id || undefined,
    customer_email: profile?.stripe_customer_id ? undefined : user.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "BoutCasts Pro membership" },
          unit_amount: PRO_PRICE_CENTS,
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/wallet?pro=success`,
    cancel_url: `${origin}/wallet?pro=cancelled`,
    metadata: {
      kind: "pro_membership",
      user_id: user.id,
    },
  });

  return NextResponse.json({ url: session.url });
}
