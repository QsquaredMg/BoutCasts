import { NextResponse } from "next/server";
import { requireElectionAccess, UUID } from "@/lib/schoolElection";
import { normalizeVideoLink } from "@/lib/clipSource";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

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

  // The candidate must belong to one of this election's offices.
  const { data: races } = await owner.admin.from("live_vote_events").select("id").eq("election_id", id);
  const { data: option } = await owner.admin.from("live_vote_options").select("id, event_id").eq("id", optionId).maybeSingle();
  if (!option || !(races ?? []).some((r) => r.id === option.event_id)) return NextResponse.json({ error: "Unknown candidate" }, { status: 404 });

  const points = (Array.isArray(body.platform) ? body.platform : []).map((p: unknown) => clean(p, 140)).filter(Boolean).slice(0, 3);
  const slogan = clean(body.slogan, 100) || null;
  // Optional video link: a valid link replaces any video; an empty one removes a pasted link (uploads stay).
  if (typeof body.videoLink === "string") {
    const raw = body.videoLink.trim();
    if (raw) {
      const link = normalizeVideoLink(raw);
      if (!link) return NextResponse.json({ error: "We can't play that link. Use a YouTube, Vimeo, TikTok or Instagram video link." }, { status: 400 });
      const { error: vErr } = await owner.admin.from("live_vote_options").update({ source_type: "link", source_url: link, media_seconds: null }).eq("id", optionId);
      if (vErr) return NextResponse.json({ error: "Couldn't save the video." }, { status: 500 });
    } else {
      await owner.admin.from("live_vote_options").update({ source_type: null, source_url: null, media_seconds: null }).eq("id", optionId).eq("source_type", "link");
    }
  }

  const { error } = await owner.admin
    .from("election_candidate_profiles")
    .upsert({ option_id: optionId, election_id: id, slogan, platform: points, updated_at: new Date().toISOString() }, { onConflict: "option_id" });
  if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
