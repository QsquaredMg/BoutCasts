import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { ORG_LICENSE } from "@/lib/liveVoteEvents/tiers";

// Start (or resume) an annual school/league license checkout. The pending
// organization row is created first so the webhook knows what to activate.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 2) {
    return NextResponse.json({ error: "Enter your school, district or league name" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { data: orgId, error } = await supabase.rpc("create_organization", { p_name: name });
  if (error || !orgId) {
    return NextResponse.json({ error: error?.message ?? "Couldn't start your license" }, { status: 400 });
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
            name: `BoutCasts School & League License — ${name}`,
            description: `${ORG_LICENSE.seats} staff accounts · unlimited Small & Medium Live Votes · Pro analytics and white-label on every event`,
          },
          unit_amount: ORG_LICENSE.priceCents,
          recurring: { interval: "year" },
        },
        quantity: 1,
      },
    ],
    subscription_data: { metadata: { kind: "org_license", org_id: orgId as string, user_id: user.id } },
    success_url: `${origin}/org?license=success`,
    cancel_url: `${origin}/org?license=cancelled`,
    metadata: { kind: "org_license", org_id: orgId as string, user_id: user.id },
  });

  return NextResponse.json({ url: session.url });
}
