import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { LIVE_VOTE_TIERS, SCHOOL_ELECTION, schoolElectionPriceCents } from "@/lib/liveVoteEvents/tiers";
import { requireElectionOwner } from "@/lib/schoolElection";

// Pay for the election: the size price, plus $25 per extra kiosk and $150 per extra day.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionOwner(id);
  if ("error" in owner) return owner.error;
  const { admin, election, user, isAdmin } = owner;
  const body = await req.json().catch(() => null);
  if (election.status !== "draft") return NextResponse.json({ error: "This election is already paid for." }, { status: 400 });

  const { count } = await admin.from("election_voters").select("id", { count: "exact", head: true }).eq("election_id", id);
  if (!count) return NextResponse.json({ error: "Add your student roster before paying." }, { status: 400 });

  const tierCfg = LIVE_VOTE_TIERS[election.tier];
  const total = schoolElectionPriceCents(election.tier, election.kiosks, election.days);
  const lines = [
    ...(tierCfg.priceCents > 0 ? [{ name: `School election: ${tierCfg.label} (up to ${tierCfg.voteCap.toLocaleString()} students, 1 day, 1 kiosk)`, cents: tierCfg.priceCents, qty: 1 }] : []),
    ...(election.kiosks > 1 ? [{ name: "Extra kiosk", cents: SCHOOL_ELECTION.extraKioskCents, qty: election.kiosks - 1 }] : []),
    ...(election.days > 1 ? [{ name: "Extra day of voting", cents: SCHOOL_ELECTION.extraDayCents, qty: election.days - 1 }] : []),
  ];
  if (lines.reduce((s, l) => s + l.cents * l.qty, 0) !== total) return NextResponse.json({ error: "Pricing mismatch. Please contact support." }, { status: 500 });

  if (body?.comp === true) {
    // Platform admin opens a school's election without a charge (grants, pilots, partner schools).
    if (!isAdmin) return NextResponse.json({ error: "Only a BoutCasts admin can do that." }, { status: 403 });
    const { error } = await admin.rpc("apply_school_election_payment", { p_election_id: id, p_session_id: "admin" });
    if (error) return NextResponse.json({ error: "Couldn't open voting. Please try again." }, { status: 500 });
    return NextResponse.json({ url: `/school-election/${id}?checkout=success` });
  }

  if (total === 0) {
    // Free election: no card needed, open voting right away.
    const { error } = await admin.rpc("apply_school_election_payment", { p_election_id: id, p_session_id: "free" });
    if (error) return NextResponse.json({ error: "Couldn't open voting. Please try again." }, { status: 500 });
    return NextResponse.json({ url: `/school-election/${id}?checkout=success` });
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  try {
    const session = await getStripe().checkout.sessions.create({
      allow_promotion_codes: true,
      mode: "payment",
      payment_method_types: ["card", "cashapp"],
      customer_email: user.email ?? undefined,
      line_items: lines.map((l) => ({
        price_data: { currency: "usd", product_data: { name: l.name, description: election.title }, unit_amount: l.cents },
        quantity: l.qty,
      })),
      success_url: `${origin}/school-election/${id}?checkout=success`,
      cancel_url: `${origin}/school-election/${id}?checkout=cancelled`,
      metadata: { kind: "school_election", election_id: id },
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("school-election: Stripe error", err);
    return NextResponse.json({ error: "Checkout is unavailable right now. Please try again." }, { status: 502 });
  }
}
