import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Cached tally for big events. Thousands of phones asking the database for the same numbers
// every few seconds is what takes a stadium-sized vote down, so the answer is built once and
// shared by the CDN for 3 seconds. Private events are never served here (clients fall back to
// their direct, link-authorised query).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Anonymous reads only see public events, so this doubles as the privacy check.
  const { data: ev } = await sb.from("live_vote_events").select("id, status, closes_at, is_private").eq("id", id).maybeSingle();
  if (!ev || ev.is_private) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, s-maxage=5" } });

  const [{ data: tally }, { data: sup }] = await Promise.all([
    sb.rpc("get_live_vote_tally", { p_event_id: id }),
    sb.rpc("get_live_vote_super_tally", { p_event_id: id }),
  ]);

  return Response.json(
    {
      status: ev.status,
      closes_at: ev.closes_at,
      tally: (tally ?? []).map((r: { option_id: string; votes: number | string }) => ({ option_id: r.option_id, votes: Number(r.votes) })),
      super: (sup ?? []).map((r: { option_id: string; super_votes: number | string }) => ({ option_id: r.option_id, super_votes: Number(r.super_votes) })),
    },
    { headers: { "Cache-Control": "public, s-maxage=3, stale-while-revalidate=6" } },
  );
}
