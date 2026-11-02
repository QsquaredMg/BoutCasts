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
  const rows: { name?: unknown; ref?: unknown; email?: unknown }[] = Array.isArray(body?.voters) ? body.voters : [];
  const voters = rows
    .map((r) => ({
      name: typeof r.name === "string" ? r.name.trim().replace(/\s+/g, " ").slice(0, 120) : "",
      ref: typeof r.ref === "string" && r.ref.trim() ? r.ref.trim().slice(0, 60) : null,
      email: typeof r.email === "string" && /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(r.email.trim()) ? r.email.trim().toLowerCase().slice(0, 200) : null,
    }))
    .filter((r) => r.name);
  if (!voters.length) return NextResponse.json({ error: "No student names found." }, { status: 400 });
  if (voters.length > 5000) return NextResponse.json({ error: "Add up to 5,000 students at a time." }, { status: 400 });

  // Students who run the election (seats) or run for office can't also be voters.
  const { data: seats } = await admin.from("election_staff").select("label").eq("election_id", id).is("revoked_at", null);
  const { data: races } = await admin.from("live_vote_events").select("id").eq("election_id", id);
  const raceIds = (races ?? []).map((r) => r.id);
  const { data: cands } = raceIds.length ? await admin.from("live_vote_options").select("name").in("event_id", raceIds) : { data: [] as { name: string }[] };
  const blocked = new Set([...(seats ?? []).map((x) => normName(x.label)), ...(cands ?? []).map((x) => normName(x.name))]);
  const clash = voters.filter((v) => blocked.has(normName(v.name))).map((v) => v.name);
  if (clash.length) {
    return NextResponse.json(
      { error: `These students run the election or are candidates, so they can't be on the voting roster: ${clash.slice(0, 5).join(", ")}${clash.length > 5 ? ` and ${clash.length - 5} more` : ""}. Remove them, or add a middle initial if they are a different student.` },
      { status: 409 },
    );
  }

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
    .insert(voters.map((v, i) => ({ election_id: id, name: v.name, name_norm: normName(v.name), student_ref: v.ref, email: v.email, code: codes[i] })));
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
