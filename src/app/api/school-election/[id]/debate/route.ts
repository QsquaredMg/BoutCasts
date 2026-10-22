import { NextResponse } from "next/server";
import { requireDeskAccess } from "@/lib/schoolElection";

// Moderator view for the debate timer: each office and its candidates. Names only, never vote counts.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireDeskAccess(req, id, ["judge"]);
  if ("error" in who) return who.error;
  const { data: races } = await who.admin.from("live_vote_events").select("id, title, election_sort").eq("election_id", id).order("election_sort");
  const ids = (races ?? []).map((r) => r.id);
  const { data: options } = ids.length ? await who.admin.from("live_vote_options").select("id, event_id, name, sort_order").in("event_id", ids).order("sort_order") : { data: [] };
  return NextResponse.json(
    { races: (races ?? []).map((r) => ({ id: r.id, title: r.title, candidates: (options ?? []).filter((o) => o.event_id === r.id).map((o) => ({ id: o.id, name: o.name })) })) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
