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

  // Code-only roster: N anonymous seats, each a random code. No names are stored, and students vote with the code alone.
  const anon = typeof body?.anonymous === "number" ? Math.floor(body.anonymous) : 0;
  if (anon > 0) {
    if (anon > 5000) return NextResponse.json({ error: "Add up to 5,000 codes at a time." }, { status: 400 });
    const { data: have } = await admin.from("election_voters").select("code, name_norm").eq("election_id", id);
    if ((have ?? []).some((r) => r.name_norm)) return NextResponse.json({ error: "This roster already has named students. Clear it first to switch to code-only." }, { status: 409 });
    const capA = LIVE_VOTE_TIERS[election.tier].voteCap;
    if ((have?.length ?? 0) + anon > capA) {
      return NextResponse.json({ error: `A ${LIVE_VOTE_TIERS[election.tier].label} election holds up to ${capA.toLocaleString()} students.` }, { status: 400 });
    }
    const codesA = generateUniqueCodes(anon, new Set((have ?? []).map((r) => r.code)));
    const { error: errA } = await admin.from("election_voters").insert(codesA.map((c) => ({ election_id: id, name: "Student", name_norm: "", code: c })));
    if (errA) {
      console.error("school-election: code-only insert failed", errA);
      return NextResponse.json({ error: "Couldn't save the codes. Please try again." }, { status: 500 });
    }
    await admin.from("school_elections").update({ code_only: true }).eq("id", id);
    return NextResponse.json({ added: anon });
  }
  if (election.code_only) return NextResponse.json({ error: "This election uses code-only voting. Add codes, not names." }, { status: 409 });
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
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionAccess(id);
  if ("error" in owner) return owner.error;
  const { admin, election } = owner;
  // ?purge=1 on a closed election deletes the whole roster (names, student ids, emails, codes) and keeps only the turnout totals.
  if (new URL(req.url).searchParams.get("purge") === "1") {
    if (owner.viewerRole === "moderator") return NextResponse.json({ error: "Only the owner can delete the roster." }, { status: 403 });
    const { data, error: pe } = await admin.rpc("purge_election_roster", { p_election_id: id });
    if (pe || !data?.ok) return NextResponse.json({ error: data?.error === "not_closed" ? "Close the election first." : "Couldn't delete the roster." }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (election.status === "closed") return NextResponse.json({ error: "This election is closed." }, { status: 400 });
  const { error } = await admin.from("election_voters").delete().eq("election_id", id).is("voted_at", null);
  if (!error) await admin.from("school_elections").update({ code_only: false }).eq("id", id).eq("code_only", true);
  if (error) return NextResponse.json({ error: "Couldn't clear the roster." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
