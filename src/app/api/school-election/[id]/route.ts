import { NextResponse } from "next/server";
import { requireElectionOwner } from "@/lib/schoolElection";

// Organizer view of one election: setup, turnout and (only after it closes) results.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionOwner(id);
  if ("error" in owner) return owner.error;
  const { admin, election, isAdmin } = owner;

  const [{ data: races }, { data: kiosks }, { count: total }, { count: voted }] = await Promise.all([
    admin.from("live_vote_events").select("id, title, election_sort").eq("election_id", id).order("election_sort"),
    admin.from("election_kiosks").select("id, label, created_at, locked_until").eq("election_id", id).order("created_at"),
    admin.from("election_voters").select("id", { count: "exact", head: true }).eq("election_id", id),
    admin.from("election_voters").select("id", { count: "exact", head: true }).eq("election_id", id).not("voted_at", "is", null),
  ]);

  const closed = election.status === "closed" || (election.closes_at != null && new Date(election.closes_at) <= new Date());
  const raceIds = (races ?? []).map((r) => r.id);
  const { data: options } = raceIds.length
    ? await admin.from("live_vote_options").select("id, event_id, name, description, sort_order").in("event_id", raceIds).order("sort_order")
    : { data: [] as { id: string; event_id: string; name: string; description: string | null; sort_order: number }[] };

  // Results are only read once voting is over. Before that the database returns nothing anyway.
  const tallies: Record<string, number> = {};
  if (closed) {
    for (const rid of raceIds) {
      const { data } = await admin.rpc("get_live_vote_tally", { p_event_id: rid });
      for (const row of (data ?? []) as { option_id: string; votes: number | string }[]) tallies[row.option_id] = Number(row.votes);
    }
  }

  const { exit_pin_hash: _pin, ...safe } = election;
  void _pin;
  return NextResponse.json({
    election: safe,
    viewerIsAdmin: isAdmin,
    closed,
    turnout: { total: total ?? 0, voted: voted ?? 0 },
    kiosks: kiosks ?? [],
    races: (races ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      options: (options ?? [])
        .filter((o) => o.event_id === r.id)
        .map((o, _i, all) => {
          const n = closed ? (tallies[o.id] ?? 0) : null;
          const top = closed ? Math.max(...all.map((x) => tallies[x.id] ?? 0)) : 0;
          return {
            id: o.id,
            name: o.name,
            description: o.description,
            // The tally is optional: when the school turned it off, only the winner is shown.
            votes: closed && election.show_tally ? n : null,
            winner: closed && top > 0 && n === top,
          };
        }),
    })),
  });
}
