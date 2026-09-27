import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { PRO_ADDON_CENTS } from "@/lib/liveVoteEvents/tiers";

// Buy the Pro analytics add-on for one event that's already live or closed
// (drafts add it in the go-live checkout instead). The webhook flips
// pro_enabled once Stripe confirms payment.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const eventId = body?.eventId;
  if (!eventId || typeof eventId !== "string") {
    return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { data: event } = await supabase
    .from("live_vote_events")
    .select("id, organizer_id, title, status, pro_enabled")
    .eq("id", eventId)
    .maybeSingle();

  if (!event || event.organizer_id !== userData.user.id) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (event.pro_enabled) {
    return NextResponse.json({ error: "Pro is already unlocked for this event" }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: userData.user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `Pro analytics — ${event.title}` },
          unit_amount: PRO_ADDON_CENTS,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/live-vote/${event.id}?checkout=pro_success`,
    cancel_url: `${origin}/live-vote/${event.id}?checkout=cancelled`,
    metadata: { kind: "live_vote_pro", event_id: event.id },
  });

  return NextResponse.json({ url: session.url });
}
