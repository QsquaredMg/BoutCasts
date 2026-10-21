import { NextResponse } from "next/server";
import { requireElectionOwner } from "@/lib/schoolElection";

// Fundraiser dashboard for an election: what supporters have given, per candidate, toward the school's goal.
// Supporter gifts are Super Votes in "separate" mode, so they never change who wins the election.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionOwner(id);
  if ("error" in owner) return owner.error;
  const { admin, election } = owner;

  const { data: races } = await admin.from("live_vote_events").select("id, title, election_sort").eq("election_id", id).order("election_sort");
  const raceIds = (races ?? []).map((r) => r.id);
  const { data: options } = raceIds.length ? await admin.from("live_vote_options").select("id, event_id, name").in("event_id", raceIds) : { data: [] as { id: string; event_id: string; name: string }[] };
  const { data: gifts } = raceIds.length
    ? await admin.from("live_vote_super_votes").select("option_id, quantity, amount_cents, organizer_share_cents, created_at").in("event_id", raceIds)
    : { data: [] as { option_id: string; quantity: number; amount_cents: number; organizer_share_cents: number; created_at: string }[] };

  const byOption = new Map<string, { gifts: number; cents: number }>();
  let gross = 0;
  let share = 0;
  for (const g of gifts ?? []) {
    const cur = byOption.get(g.option_id) ?? { gifts: 0, cents: 0 };
    cur.gifts += 1;
    cur.cents += g.amount_cents;
    byOption.set(g.option_id, cur);
    gross += g.amount_cents;
    share += g.organizer_share_cents;
  }
  return NextResponse.json({
    enabled: election.fundraiser_enabled,
    goalCents: election.fundraiser_goal_cents,
    grossCents: gross,
    schoolShareCents: share,
    giftCount: (gifts ?? []).length,
    races: (races ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      candidates: (options ?? [])
        .filter((o) => o.event_id === r.id)
        .map((o) => ({ id: o.id, name: o.name, ...(byOption.get(o.id) ?? { gifts: 0, cents: 0 }) }))
        .sort((a, b) => b.cents - a.cents),
    })),
  });
}

// Turn the fundraiser on or off and set a goal. Not available for practice elections or after voting closes.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionOwner(id);
  if ("error" in owner) return owner.error;
  const { admin, election } = owner;
  if (election.is_practice) return NextResponse.json({ error: "Practice elections can't raise money." }, { status: 400 });
  if (election.status === "closed") return NextResponse.json({ error: "Voting has closed." }, { status: 400 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.enabled !== "boolean") return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  let goal: number | null = election.fundraiser_goal_cents;
  if ("goalDollars" in body) {
    if (body.goalDollars === null || body.goalDollars === "") goal = null;
    else {
      const dollars = Number(body.goalDollars);
      if (!Number.isInteger(dollars) || dollars < 1 || dollars > 1_000_000) return NextResponse.json({ error: "Goal must be a whole number of dollars, 1 to 1,000,000." }, { status: 400 });
      goal = dollars * 100;
    }
  }
  const { error } = await admin.from("school_elections").update({ fundraiser_enabled: body.enabled, fundraiser_goal_cents: goal }).eq("id", id);
  if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  // The races carry the Super Vote setting. "separate" keeps gifts out of the vote count entirely.
  const { error: raceErr } = await admin.from("live_vote_events").update({ super_votes_enabled: body.enabled, super_votes_mode: "separate" }).eq("election_id", id);
  if (raceErr) return NextResponse.json({ error: "Couldn't update the offices." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
