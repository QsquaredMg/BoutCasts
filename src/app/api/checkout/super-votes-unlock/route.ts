import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { SUPER_VOTES } from "@/lib/liveVoteEvents/tiers";

// Organizer pays once to switch Super Votes on for one event.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const eventId = body?.eventId;
  if (!eventId || typeof eventId !== "string") return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { data: event } = await supabase
    .from("live_vote_events")
    .select("id, organizer_id, title, status, tier, scoring_mode, voting_method, super_votes_enabled")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.organizer_id !== userData.user.id) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.super_votes_enabled) return NextResponse.json({ error: "Super Votes are already on" }, { status: 400 });
  if (event.status === "closed") return NextResponse.json({ error: "Voting has closed" }, { status: 400 });
  if (event.tier === "free" || event.scoring_mode !== "crowd" || event.voting_method !== "single") {
    return NextResponse.json({ error: "Super Votes need a paid crowd \"pick one\" event" }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    // Card also covers Apple Pay and Link; Cash App Pay is one-time payments in USD.
    payment_method_types: ["card", "cashapp"],
    customer_email: userData.user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `Super Votes — ${event.title}` },
          unit_amount: SUPER_VOTES.unlockCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/live-vote/${event.id}?checkout=super_success`,
    cancel_url: `${origin}/live-vote/${event.id}?checkout=cancelled`,
    metadata: { kind: "super_votes_unlock", event_id: event.id },
  });
  return NextResponse.json({ url: session.url });
}
