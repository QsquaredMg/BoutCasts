import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUPER_VOTES } from "@/lib/liveVoteEvents/tiers";
import { UUID, isOpen, type ElectionRow } from "@/lib/schoolElection";

// A supporter gives to the school's fundraiser, naming a candidate they back. No account needed.
// Gifts are recorded as Super Votes in "separate" mode: they never count as votes.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const pack = SUPER_VOTES.packs.find((p) => p.key === body?.pack);
  if (!pack || typeof body?.optionId !== "string" || !UUID.test(body.optionId)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const admin = createAdminClient();
  const { data: el } = await admin.from("school_elections").select("*").eq("id", id).maybeSingle();
  const election = el as ElectionRow | null;
  if (!election || !election.fundraiser_enabled || election.is_practice) return NextResponse.json({ error: "This fundraiser isn't open." }, { status: 400 });
  if (!isOpen(election)) return NextResponse.json({ error: "Voting has closed." }, { status: 400 });

  const { data: option } = await admin.from("live_vote_options").select("id, name, event_id").eq("id", body.optionId).maybeSingle();
  if (!option) return NextResponse.json({ error: "Unknown candidate" }, { status: 400 });
  const { data: race } = await admin.from("live_vote_events").select("id, title, election_id, super_votes_enabled").eq("id", option.event_id).maybeSingle();
  if (!race || race.election_id !== id || !race.super_votes_enabled) return NextResponse.json({ error: "Unknown candidate" }, { status: 400 });

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  let session;
  try {
    session = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "cashapp"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Support ${option.name} (${race.title})`,
              description: `${election.title}${election.school_name ? ` · ${election.school_name}` : ""}: gift to the school fundraiser. Does not count as a vote.`,
            },
            unit_amount: pack.cents,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/school-election/${id}/support?thanks=1`,
      cancel_url: `${origin}/school-election/${id}/support`,
      metadata: { kind: "super_votes", event_id: race.id, option_id: option.id, quantity: String(pack.quantity), tier: "pack" },
    });
  } catch (err) {
    console.error("school-election/support: Stripe error", err);
    return NextResponse.json({ error: "Checkout is unavailable right now. Please try again." }, { status: 502 });
  }
  return NextResponse.json({ url: session.url });
}
