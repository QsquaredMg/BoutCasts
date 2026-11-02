import { NextResponse } from "next/server";
import { requireDeskAccess, saveCandidateProfile } from "@/lib/schoolElection";

const MINE = ["candidate", "campaign_manager"];

// A candidate or campaign manager edits only their own candidate's page. The seat is tied to one candidate.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireDeskAccess(req, id, MINE);
  if ("error" in who) return who.error;
  if (!who.optionId) return NextResponse.json({ error: "This seat isn't tied to a candidate yet. Ask your teacher." }, { status: 400 });
  const { data: opt } = await who.admin.from("live_vote_options").select("id, name, source_type, source_url").eq("id", who.optionId).maybeSingle();
  const { data: profile } = await who.admin.from("election_candidate_profiles").select("slogan, platform, survey_finding").eq("option_id", who.optionId).maybeSingle();
  return NextResponse.json(
    { name: opt?.name ?? "", slogan: profile?.slogan ?? "", surveyFinding: profile?.survey_finding ?? "", platform: [...(profile?.platform ?? []), "", "", ""].slice(0, 3), video: opt?.source_type === "link" ? opt.source_url ?? "" : "" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireDeskAccess(req, id, MINE);
  if ("error" in who) return who.error;
  if (!who.optionId) return NextResponse.json({ error: "This seat isn't tied to a candidate yet. Ask your teacher." }, { status: 400 });
  const { data: el } = await who.admin.from("school_elections").select("status").eq("id", id).maybeSingle();
  if (el?.status === "closed") return NextResponse.json({ error: "Voting has closed." }, { status: 400 });
  const body = await req.json().catch(() => null);
  const r = await saveCandidateProfile(who.admin, id, who.optionId, body ?? {});
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
