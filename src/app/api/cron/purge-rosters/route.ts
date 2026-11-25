import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROSTER_RETENTION_DAYS } from "@/lib/rosterRetention";

// Daily: deletes the roster (names, student ids, emails, codes) of every school election that closed
// more than ROSTER_RETENTION_DAYS ago. Results and turnout totals are kept.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = createAdminClient();
  const cutoff = new Date(Date.now() - ROSTER_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: due, error } = await db
    .from("school_elections")
    .select("id")
    .eq("status", "closed")
    .is("roster_purged_at", null)
    .lt("closes_at", cutoff)
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let purged = 0;
  for (const el of due ?? []) {
    const { data } = await db.rpc("purge_election_roster", { p_election_id: el.id });
    if (data?.ok) purged += 1;
  }
  return NextResponse.json({ purged });
}
