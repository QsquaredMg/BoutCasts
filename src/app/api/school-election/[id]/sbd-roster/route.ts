import { NextRequest, NextResponse } from "next/server";
import { LIVE_VOTE_TIERS } from "@/lib/liveVoteEvents/tiers";
import { generateUniqueCodes, normName, requireElectionAccess } from "@/lib/schoolElection";
import { sbdCall } from "@/lib/sbdPartner";

// Bring the verified students of the linked School-B-Doo school onto the voting roster.
//   { action: "preview" }             -> the classes available, with counts
//   { action: "import", years: [..] } -> add those classes (names and class year only)
type Member = { ref: string; name: string; year: number | null };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionAccess(id);
  if ("error" in owner) return owner.error;
  const { admin, election } = owner;
  const sid = (election as unknown as { sbd_school_id?: string | null }).sbd_school_id;
  if (!sid) return NextResponse.json({ error: "This election isn't linked to a School-B-Doo school." }, { status: 400 });
  if (election.status === "closed") return NextResponse.json({ error: "This election is closed." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const years: number[] = Array.isArray(body?.years) ? body.years.map(Number).filter((n: number) => Number.isInteger(n) && n > 1990 && n < 2100).slice(0, 12) : [];
  const preview = body?.action !== "import";
  if (!preview && !years.length) return NextResponse.json({ error: "Pick at least one class." }, { status: 400 });

  const r = await sbdCall("election.roster", { sid, eid: id, action: preview ? "preview" : "import", years: years.join(",") });
  if (!r || r.error) return NextResponse.json({ error: typeof r?.error_description === "string" ? r.error_description : "Couldn't reach School-B-Doo. Try again in a minute." }, { status: 502 });
  if (preview) return NextResponse.json({ classes: Array.isArray(r.classes) ? r.classes : [] });

  const members = (Array.isArray(r.members) ? (r.members as Member[]) : []).filter((m) => m && typeof m.ref === "string" && typeof m.name === "string" && m.name.trim());
  if (!members.length) return NextResponse.json({ error: "No verified students found in those classes." }, { status: 400 });

  const { data: seats } = await admin.from("election_staff").select("label").eq("election_id", id).is("revoked_at", null);
  const { data: races } = await admin.from("live_vote_events").select("id").eq("election_id", id);
  const raceIds = (races ?? []).map((x) => x.id);
  const { data: cands } = raceIds.length ? await admin.from("live_vote_options").select("name").in("event_id", raceIds) : { data: [] as { name: string }[] };
  const blocked = new Set([...(seats ?? []).map((x) => normName(x.label)), ...(cands ?? []).map((x) => normName(x.name))]);
  // Supabase returns at most 1,000 rows per request, so read the whole roster in pages.
  const existing: { code: string; name_norm: string; student_ref: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: page, error: pageErr } = await admin.from("election_voters").select("code, name_norm, student_ref").eq("election_id", id).order("id").range(from, from + 999);
    if (pageErr) return NextResponse.json({ error: "Couldn't read the roster. Please try again." }, { status: 500 });
    existing.push(...(page ?? []));
    if ((page?.length ?? 0) < 1000) break;
  }
  const haveRef = new Set(existing.map((x) => x.student_ref).filter(Boolean));
  const haveName = new Set(existing.map((x) => x.name_norm));

  const skipped = { candidates: 0, sameName: 0, already: 0 };
  const fresh: { name: string; ref: string }[] = [];
  for (const m of members) {
    const n = normName(m.name.slice(0, 120));
    if (haveRef.has(m.ref)) { skipped.already++; continue; }
    if (blocked.has(n)) { skipped.candidates++; continue; }
    if (haveName.has(n)) { skipped.sameName++; continue; }
    haveName.add(n);
    fresh.push({ name: m.name.trim().replace(/\s+/g, " ").slice(0, 120), ref: m.ref.slice(0, 60) });
  }
  if (!fresh.length) return NextResponse.json({ added: 0, skipped });

  const cap = LIVE_VOTE_TIERS[election.tier].voteCap;
  if (existing.length + fresh.length > cap) return NextResponse.json({ error: `A ${LIVE_VOTE_TIERS[election.tier].label} election holds up to ${cap.toLocaleString()} students. Pick a larger size or fewer classes.` }, { status: 400 });

  const codes = generateUniqueCodes(fresh.length, new Set(existing.map((x) => x.code)));
  const { error } = await admin.from("election_voters").insert(fresh.map((v, i) => ({ election_id: id, name: v.name, name_norm: normName(v.name), student_ref: v.ref, code: codes[i] })));
  if (error) {
    console.error("school-election: sbd roster insert failed", error);
    return NextResponse.json({ error: "Couldn't save the roster. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ added: fresh.length, skipped });
}
