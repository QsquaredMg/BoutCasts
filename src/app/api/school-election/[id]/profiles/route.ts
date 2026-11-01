import { NextResponse } from "next/server";
import { requireElectionAccess, saveCandidateProfile, UUID } from "@/lib/schoolElection";

// Candidate campaign profiles: a slogan and up to three platform points per candidate.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionAccess(id);
  if ("error" in owner) return owner.error;
  const { data } = await owner.admin.from("election_candidate_profiles").select("option_id, slogan, platform").eq("election_id", id);
  // Pasted video links (YouTube, Vimeo, ...) live on the candidate's ballot entry.
  const { data: races } = await owner.admin.from("live_vote_events").select("id").eq("election_id", id);
  const raceIds = (races ?? []).map((r) => r.id);
  const { data: opts } = raceIds.length ? await owner.admin.from("live_vote_options").select("id, source_url").in("event_id", raceIds).eq("source_type", "link") : { data: [] as { id: string; source_url: string | null }[] };
  const videos = Object.fromEntries((opts ?? []).filter((o) => o.source_url).map((o) => [o.id, o.source_url as string]));
  return NextResponse.json({ profiles: data ?? [], videos }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionAccess(id);
  if ("error" in owner) return owner.error;
  if (owner.election.status === "closed") return NextResponse.json({ error: "Voting has closed." }, { status: 400 });
  const body = await req.json().catch(() => null);
  const optionId = body?.optionId;
  if (typeof optionId !== "string" || !UUID.test(optionId)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const r = await saveCandidateProfile(owner.admin, id, optionId, body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
