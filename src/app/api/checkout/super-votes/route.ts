import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { SUPER_VOTES } from "@/lib/liveVoteEvents/tiers";

// A fan buys a Super Vote pack for one contestant. No account needed.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { eventId, optionId, pack, amountCents } = body ?? {};
  const isPlatinum = pack === "platinum";
  const regularPack = SUPER_VOTES.packs.find((p) => p.key === pack);
  if (typeof eventId !== "string" || typeof optionId !== "string" || (!regularPack && !isPlatinum)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("live_vote_events")
    .select("id, title, status, closes_at, super_votes_enabled, super_votes_platinum_cents")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || !event.super_votes_enabled) return NextResponse.json({ error: "Super Votes aren't available here" }, { status: 400 });
  if (event.status !== "live" || (event.closes_at && new Date(event.closes_at) <= new Date())) {
    return NextResponse.json({ error: "Voting is closed" }, { status: 400 });
  }
  const { data: option } = await supabase
    .from("live_vote_options")
    .select("id, name")
    .eq("id", optionId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!option) return NextResponse.json({ error: "Unknown contestant" }, { status: 400 });

  // Platinum Supporter: the organizer's fixed price when set, otherwise any
  // whole-dollar amount of $20 or more chosen by the fan.
  let packCfg: { quantity: number; cents: number };
  if (isPlatinum) {
    const fixed = event.super_votes_platinum_cents as number | null;
    const cents = fixed ?? Number(amountCents);
    if (!Number.isInteger(cents) || cents < SUPER_VOTES.platinumMinCents || cents > 1_000_000 || (fixed == null && cents % 100 !== 0)) {
      return NextResponse.json({ error: "Platinum Supporter starts at $20." }, { status: 400 });
    }
    packCfg = { quantity: Math.round((cents / 100) * SUPER_VOTES.platinumVotesPerDollar), cents };
  } else {
    packCfg = regularPack!;
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  let session;
  try {
  session = await getStripe().checkout.sessions.create({
    mode: "payment",
    // Card also covers Apple Pay and Link; Cash App Pay is one-time payments in USD.
    payment_method_types: ["card", "cashapp"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${isPlatinum ? "Platinum Supporter: " : ""}${packCfg.quantity} Super Votes for ${option.name}`,
            description: event.title,
          },
          unit_amount: packCfg.cents,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/vote/${event.id}?boost=success`,
    cancel_url: `${origin}/vote/${event.id}`,
    metadata: {
      kind: "super_votes",
      event_id: event.id,
      option_id: option.id,
      quantity: String(packCfg.quantity),
      tier: isPlatinum ? "platinum" : "pack",
    },
  });
  } catch (err) {
    console.error("checkout/super-votes: Stripe error", err);
    return NextResponse.json({ error: "Checkout is unavailable right now — please try again." }, { status: 502 });
  }
  return NextResponse.json({ url: session.url });
}
