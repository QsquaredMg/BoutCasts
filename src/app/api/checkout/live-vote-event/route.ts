import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { LIVE_VOTE_TIERS, isLiveVoteTier } from "@/lib/liveVoteEvents/tiers";

// Organizer pays a one-time per-event fee to move their draft Live Vote
// Event live. The event (and its options) must already exist as a 'draft'
// row the organizer owns — created via the normal authenticated insert
// path, which RLS restricts to the organizer themselves. This route never
// trusts a client-supplied price: it looks up the event's tier and derives
// the charge from LIVE_VOTE_TIERS, and the DB additionally enforces that
// tier/price_cents pairing via a CHECK constraint.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const eventId = body?.eventId;

  if (!eventId || typeof eventId !== "string") {
    return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { data: event, error: eventError } = await supabase
    .from("live_vote_events")
    .select("id, organizer_id, title, tier, price_cents, status")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) {
    console.error("checkout/live-vote-event: failed to load event", eventError);
    return NextResponse.json({ error: "Failed to load event" }, { status: 500 });
  }

  if (!event || event.organizer_id !== userData.user.id) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.status !== "draft") {
    return NextResponse.json(
      { error: "This event has already been paid for or is no longer a draft" },
      { status: 400 }
    );
  }

  if (!isLiveVoteTier(event.tier)) {
    return NextResponse.json({ error: "Event has an invalid tier" }, { status: 400 });
  }

  const tierConfig = LIVE_VOTE_TIERS[event.tier];

  if (event.price_cents !== tierConfig.priceCents) {
    // Should be impossible given the DB constraint, but never charge an
    // amount that doesn't match what we're about to grant.
    console.error("checkout/live-vote-event: price/tier mismatch", event);
    return NextResponse.json({ error: "Event pricing is inconsistent" }, { status: 500 });
  }

  const { count: optionCount, error: optionsError } = await supabase
    .from("live_vote_options")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event.id);

  if (optionsError) {
    console.error("checkout/live-vote-event: failed to count options", optionsError);
    return NextResponse.json({ error: "Failed to load event options" }, { status: 500 });
  }

  if (!optionCount || optionCount < 2) {
    return NextResponse.json(
      { error: "Add at least two options before going live" },
      { status: 400 }
    );
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: userData.user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Live Vote Event (${tierConfig.label}) — ${event.title}`,
          },
          unit_amount: tierConfig.priceCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/live-vote/${event.id}?checkout=success`,
    cancel_url: `${origin}/live-vote/${event.id}?checkout=cancelled`,
    metadata: {
      kind: "live_vote_event",
      event_id: event.id,
      tier: event.tier,
    },
  });

  return NextResponse.json({ url: session.url });
}
