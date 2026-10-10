import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lookupFinalScore } from "@/lib/predictions/liveScores";
import { TEAM_FIELDS, type DirectoryTeam } from "@/lib/teams/directory";

// "Fetch final score" button: looks the score up and returns it for the admin to review.
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { data: prof } = await supabase.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle();
  if (!prof?.is_admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("game") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad game id" }, { status: 400 });
  const db = createAdminClient();
  const { data: g } = await db.from("pred_games").select("home_name, away_name, starts_at").eq("id", id).maybeSingle();
  if (!g) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  const { data: dir } = await db.from("team_directory").select(TEAM_FIELDS).eq("hidden", false).limit(2000);
  const found = await lookupFinalScore(g, (dir ?? []) as DirectoryTeam[]);
  return NextResponse.json(found, { status: found.ok ? 200 : 404 });
}
