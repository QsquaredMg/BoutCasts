import { NextResponse } from "next/server";
import { requireElectionOwner, UUID } from "@/lib/schoolElection";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Candidate campaign profiles: a slogan and up to three platform points per candidate.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionOwner(id);
  if ("error" in owner) return owner.error;
  const { data } = await owner.admin.from("election_candidate_profiles").select("option_id, slogan, platform").eq("election_id", id);
  return NextResponse.json({ profiles: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionOwner(id);
  if ("error" in owner) return owner.error;
  if (owner.election.status === "closed") return NextResponse.json({ error: "Voting has closed." }, { status: 400 });
  const body = await req.json().catch(() => null);
  const optionId = body?.optionId;
  if (typeof optionId !== "string" || !UUID.test(optionId)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  // The candidate must belong to one of this election's offices.
  const { data: races } = await owner.admin.from("live_vote_events").select("id").eq("election_id", id);
  const { data: option } = await owner.admin.from("live_vote_options").select("id, event_id").eq("id", optionId).maybeSingle();
  if (!option || !(races ?? []).some((r) => r.id === option.event_id)) return NextResponse.json({ error: "Unknown candidate" }, { status: 404 });

  const points = (Array.isArray(body.platform) ? body.platform : []).map((p: unknown) => clean(p, 140)).filter(Boolean).slice(0, 3);
  const slogan = clean(body.slogan, 100) || null;
  const { error } = await owner.admin
    .from("election_candidate_profiles")
    .upsert({ option_id: optionId, election_id: id, slogan, platform: points, updated_at: new Date().toISOString() }, { onConflict: "option_id" });
  if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
