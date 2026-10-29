import { NextRequest, NextResponse } from "next/server";
import { LIVE_VOTE_TIERS } from "@/lib/liveVoteEvents/tiers";
import { generateUniqueCodes, normName, requireElectionAccess } from "@/lib/schoolElection";

// Add students to the roster. Each one gets a random single-use code.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionAccess(id);
  if ("error" in owner) return owner.error;
  const { admin, election } = owner;
  if (election.status === "closed") return NextResponse.json({ error: "This election is closed." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const rows: { name?: unknown; ref?: unknown }[] = Array.isArray(body?.voters) ? body.voters : [];
  const voters = rows
    .map((r) => ({
      name: typeof r.name === "string" ? r.name.trim().replace(/\s+/g, " ").slice(0, 120) : "",
      ref: typeof r.ref === "string" && r.ref.trim() ? r.ref.trim().slice(0, 60) : null,
    }))
    .filter((r) => r.name);
  if (!voters.length) return NextResponse.json({ error: "No student names found." }, { status: 400 });
  if (voters.length > 5000) return NextResponse.json({ error: "Add up to 5,000 students at a time." }, { status: 400 });

  const { data: existing } = await admin.from("election_voters").select("code").eq("election_id", id);
  const cap = LIVE_VOTE_TIERS[election.tier].voteCap;
  if ((existing?.length ?? 0) + voters.length > cap) {
    return NextResponse.json(
      { error: `A ${LIVE_VOTE_TIERS[election.tier].label} election holds up to ${cap.toLocaleString()} students. Pick a larger size or shorten the roster.` },
      { status: 400 },
    );
  }

  const codes = generateUniqueCodes(voters.length, new Set((existing ?? []).map((r) => r.code)));
  const { error } = await admin
    .from("election_voters")
    .insert(voters.map((v, i) => ({ election_id: id, name: v.name, name_norm: normName(v.name), student_ref: v.ref, code: codes[i] })));
  if (error) {
    console.error("school-election: roster insert failed", error);
    return NextResponse.json({ error: "Couldn't save the roster. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ added: voters.length });
}

// Remove every student who has not voted yet (to re-upload a corrected roster).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionAccess(id);
  if ("error" in owner) return owner.error;
  const { admin, election } = owner;
  if (election.status === "closed") return NextResponse.json({ error: "This election is closed." }, { status: 400 });
  const { error } = await admin.from("election_voters").delete().eq("election_id", id).is("voted_at", null);
  if (error) return NextResponse.json({ error: "Couldn't clear the roster." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
