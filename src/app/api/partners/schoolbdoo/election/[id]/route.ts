import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID } from "@/lib/schoolElection";
import { verifyRequest } from "@/lib/sbdPartner";

export const dynamic = "force-dynamic";

// Server to server. School-B-Doo asks about one linked election and, optionally, one student:
//   GET /api/partners/schoolbdoo/election/<id>?sid=<school>&ref=<student id>
// Returns the state of the election, the winners once it is certified, and that student's own code.
// Never returns anyone else's code, and never how anyone voted.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  if (!verifyRequest(req.headers.get("x-sbd-signature"), "GET", url.pathname + url.search, "")) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const sid = url.searchParams.get("sid") ?? "";
  const ref = (url.searchParams.get("ref") ?? "").slice(0, 60);
  const admin = createAdminClient();
  const { data: e } = await admin.from("school_elections").select("id, title, school_name, status, closes_at, certified_at, is_practice, show_tally, link_voting, sbd_school_id").eq("id", id).maybeSingle();
  if (!e || !sid || e.sbd_school_id !== sid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const over = e.status === "closed" || (e.closes_at != null && new Date(e.closes_at) <= new Date());
  const { data: races } = await admin.from("live_vote_events").select("id, title").eq("election_id", id).order("election_sort");
  let results: { office: string; winners: string; votes: number | null }[] | null = null;
  if (e.certified_at && over && !e.is_practice) {
    results = [];
    for (const r of races ?? []) {
      const [{ data: opts }, { data: tally }] = await Promise.all([admin.from("live_vote_options").select("id, name").eq("event_id", r.id), admin.rpc("get_live_vote_tally", { p_event_id: r.id })]);
      const counts = new Map<string, number>(((tally ?? []) as { option_id: string; votes: number | string }[]).map((t) => [t.option_id, Number(t.votes)]));
      const top = Math.max(0, ...(opts ?? []).map((o) => counts.get(o.id) ?? 0));
      const w = top > 0 ? (opts ?? []).filter((o) => (counts.get(o.id) ?? 0) === top) : [];
      results.push({ office: r.title, winners: w.length ? w.map((o) => o.name).join(" & ") + (w.length > 1 ? " (tie)" : "") : "No votes cast", votes: e.show_tally && top > 0 ? top : null });
    }
  }

  let voter: { name: string; code: string; voted: boolean } | null = null;
  if (ref) {
    const { data: v } = await admin.from("election_voters").select("name, code, voted_at").eq("election_id", id).eq("student_ref", ref).maybeSingle();
    if (v) voter = { name: v.name, code: v.code, voted: !!v.voted_at };
  }
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.boutcasts.com").replace(/\/+$/, "");
  return NextResponse.json(
    {
      title: e.title,
      school: e.school_name,
      status: over ? "closed" : e.status,
      closesAt: e.closes_at,
      certified: !!e.certified_at && !e.is_practice,
      linkVoting: e.link_voting,
      offices: (races ?? []).map((r) => r.title),
      results,
      voter,
      voteUrl: `${origin}/school-election/${id}/vote`,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
