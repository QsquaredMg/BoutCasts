import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lookupFinalScore } from "@/lib/predictions/liveScores";
import { TEAM_FIELDS, type DirectoryTeam } from "@/lib/teams/directory";

// Every 15 minutes: finds admin-created prediction games that should be over, looks
// up the final score, and scores them the same way the manual button does.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = createAdminClient();
  const now = Date.now();
  const { data: games } = await db
    .from("pred_games")
    .select("id, home_name, away_name, starts_at, allow_draw, round, created_by")
    .eq("status", "scheduled")
    .is("archived_at", null)
    .lt("starts_at", new Date(now - 60 * 60 * 1000).toISOString())
    .gt("starts_at", new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString())
    .order("starts_at")
    .limit(40);
  if (!games?.length) return NextResponse.json({ checked: 0, finalized: 0 });

  const { data: dir } = await db.from("team_directory").select(TEAM_FIELDS).eq("hidden", false).limit(2000);
  const directory = (dir ?? []) as DirectoryTeam[];
  const notes: string[] = [];
  let finalized = 0;

  for (const g of games) {
    if (g.round !== null && (g.home_name === "TBD" || g.away_name === "TBD")) continue;
    const found = await lookupFinalScore(g, directory);
    if (!found.ok) continue; // not finished or not found: try again next run
    const { home, away } = found.score;
    if (home === away && !g.allow_draw && g.round === null) { notes.push(`${g.id}: tie on a no-draw game`); continue; }
    const { error } = await db.rpc("auto_finalize_pred_game", { p_game: g.id, p_home: home, p_away: away });
    if (error) notes.push(`${g.id}: ${error.message}`);
    else finalized++;
  }
  if (notes.length) console.error("pred-scores:", notes.join(" | "));
  return NextResponse.json({ checked: games.length, finalized, notes });
}
