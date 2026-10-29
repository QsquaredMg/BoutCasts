import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID } from "@/lib/schoolElection";

// Public: vote by link. A student enters their own code and name, then votes each office once.
// See docs/sql/election_link_voting.sql. Choices are never tied to the student.
const MESSAGES: Record<string, string> = {
  no_match: "That code and name don't match. Check both and try again.",
  locked: "Too many wrong tries. Wait 10 minutes, or ask a teacher for help.",
  closed: "Voting has closed for this election.",
  not_open: "Voting hasn't opened yet.",
  not_available: "Voting by link isn't turned on for this election.",
  not_registered: "You need to register before you can vote. Ask a teacher.",
  voted_at_kiosk: "You already voted at a voting booth.",
  already_voted_office: "You already voted for this office.",
  bad_choice: "That choice isn't on the ballot. Refresh and try again.",
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.slice(0, 20) : "";
  const name = typeof body?.name === "string" ? body.name.slice(0, 120) : "";
  if (!code.trim() || !name.trim()) return NextResponse.json({ ok: false, error: "Enter your code and your name." }, { status: 400 });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const ipHash = ip ? createHash("sha256").update(`linkvote:${id}:${ip}`).digest("hex").slice(0, 32) : "";
  const admin = createAdminClient();

  if (body?.action === "cast") {
    const raceId = typeof body.raceId === "string" ? body.raceId : "";
    const optionId = typeof body.optionId === "string" ? body.optionId : "";
    if (!UUID.test(raceId) || !UUID.test(optionId)) return NextResponse.json({ ok: false, error: "Pick a candidate." }, { status: 400 });
    const { data, error } = await admin.rpc("link_vote_cast", { p_election_id: id, p_code: code, p_name: name, p_race_id: raceId, p_option_id: optionId, p_ip_hash: ipHash });
    if (error) {
      console.error("vote-link cast failed", error);
      return NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 });
    }
    if (!data?.ok) return NextResponse.json({ ok: false, error: MESSAGES[data?.error as string] ?? "Couldn't record your vote.", code: data?.error }, { status: 400 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  }

  const { data, error } = await admin.rpc("link_vote_open", { p_election_id: id, p_code: code, p_name: name, p_ip_hash: ipHash });
  if (error) {
    console.error("vote-link open failed", error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
  if (!data?.ok) return NextResponse.json({ ok: false, error: MESSAGES[data?.error as string] ?? "Couldn't check you in.", code: data?.error }, { status: 400 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
