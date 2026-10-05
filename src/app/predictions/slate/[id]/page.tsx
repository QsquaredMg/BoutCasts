import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GameCard from "@/components/GameCard";
import PredLeaderboardTable from "@/components/PredLeaderboardTable";
import WinnersGraphic from "@/components/WinnersGraphic";
import ShareButton from "@/components/ShareButton";
import { GAME_FIELDS, type LeaderRow, type PredGame } from "@/lib/predictions/types";

type Props = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Slate not found" };
  const supabase = await createClient();
  const { data } = await supabase.from("pred_slates").select("title").eq("id", id).maybeSingle();
  if (!data) return { title: "Slate not found" };
  return { title: data.title, description: `Weekly pick'em: predict every game in ${data.title} and compete for the top of the slate leaderboard.` };
}

export default async function SlatePage({ params }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  const { data: slate } = await supabase.from("pred_slates").select("id, title, created_by").eq("id", id).maybeSingle();
  if (!slate) notFound();

  const [{ data: gameRows }, { data: lb }] = await Promise.all([
    supabase.from("pred_games").select(GAME_FIELDS).eq("slate_id", id).neq("status", "cancelled").order("starts_at"),
    supabase.rpc("pred_leaderboard", { p_scope: "season", p_slate: id, p_limit: 25 }),
  ]);
  const games = (gameRows ?? []) as PredGame[];
  const rows = (lb ?? []) as LeaderRow[];
  const allFinal = games.length > 0 && games.every((g) => g.status === "final");
  const finals = games.filter((g) => g.status === "final").length;

  const mine: Record<string, { pred_home: number; pred_away: number; pts_total: number | null }> = {};
  if (user && games.length) {
    const { data: picks } = await supabase.from("pred_predictions").select("game_id, pred_home, pred_away, pts_total").eq("user_id", user.id).in("game_id", games.map((g) => g.id));
    for (const p of picks ?? []) mine[p.game_id] = p;
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/predictions" className="mb-4 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>&larr; Bout Predictions</Link>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--blue)" }}>Weekly slate</p>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{slate.title}</h1>
      <p className="mb-4 text-sm" style={{ color: "var(--text-faint)" }}>{games.length} {games.length === 1 ? "game" : "games"} · {finals} final · points add up across the whole slate</p>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {user?.id === slate.created_by && (
          <Link href={`/predictions/new?slate=${slate.id}`} className="bc-btn-solid rounded-full px-5 py-2.5 text-sm font-bold">Add a game</Link>
        )}
        <ShareButton title={slate.title} text={`${slate.title}: make your picks on BoutCasts!`} />
      </div>

      <section className="mb-8 grid gap-3">
        {games.length === 0 ? <p className="bc-card p-5 text-sm" style={{ color: "var(--text-dim)" }}>No games have been added yet.</p> : games.map((g) => <GameCard key={g.id} game={g} mine={mine[g.id]} />)}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>Slate leaderboard</h2>
        <PredLeaderboardTable rows={rows} meId={user?.id} />
      </section>

      {rows.length > 0 && (
        <WinnersGraphic
          title={slate.title}
          subtitle={allFinal ? "Slate winners" : `Leaders after ${finals} of ${games.length} games`}
          winners={rows.slice(0, 3).map((r) => ({ name: r.username ?? "Player", points: Number(r.points), detail: `${r.games} games · ${r.perfect} perfect` }))}
          fileName={`slate-winners-${slate.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
        />
      )}
    </div>
  );
}
