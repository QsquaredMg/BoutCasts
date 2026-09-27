import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";

// Stripe-hosted billing page: update card, see invoices, cancel Organizer Pro.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const { data: sub } = await supabase
    .from("organizer_subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: "No Organizer Pro billing found for this account" }, { status: 404 });
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/live-vote`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (err) {
    console.error("billing/portal: failed to create session", err);
    return NextResponse.json({ error: "Billing page is unavailable right now. Please contact support." }, { status: 500 });
  }
}
