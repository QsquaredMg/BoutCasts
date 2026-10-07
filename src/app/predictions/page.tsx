import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import GameCard from "@/components/GameCard";
import PredHero from "@/components/PredHero";
import PredLeaderboardTable from "@/components/PredLeaderboardTable";
import { GAME_FIELDS, isLocked, type LeaderRow, type PredGame } from "@/lib/predictions/types";
import { SCORING } from "@/lib/predictions/scoring";
import { BRACKET_PRICING, money } from "@/lib/predictions/pricing";

export const metadata: Metadata = {
  title: "Bout Predictions",
  description: "Pick the winner and the final score before the game starts, earn points for every prediction, and climb the weekly and season leaderboards.",
  alternates: { canonical: "/predictions" },
};

export default async function PredictionsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  const [{ data: gameRows }, { data: slateRows }, { data: lb }] = await Promise.all([
    supabase.from("pred_games").select(GAME_FIELDS).neq("status", "cancelled").eq("is_private", false).is("round", null).order("starts_at", { ascending: false }).limit(60),
    supabase.from("pred_slates").select("id, title, kind, tier, status, created_by").eq("visibility", "public").order("created_at", { ascending: false }).limit(12),
    supabase.rpc("pred_leaderboard", { p_scope: "week", p_limit: 5 }),
  ]);
  const games = (gameRows ?? []) as PredGame[];
  const { data: myPrivate } = user
    ? await supabase.from("pred_slates").select("id, title, status").eq("visibility", "private").eq("created_by", user.id).order("created_at", { ascending: false }).limit(10)
    : { data: null };

  const mine: Record<string, { pred_home: number; pred_away: number; pts_total: number | null }> = {};
  if (user && games.length) {
    const { data: picks } = await supabase.from("pred_predictions").select("game_id, pred_home, pred_away, pts_total").eq("user_id", user.id).in("game_id", games.map((g) => g.id));
    for (const p of picks ?? []) mine[p.game_id] = p;
  }

  const open = games.filter((g) => !isLocked(g)).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const live = games.filter((g) => g.status === "scheduled" && isLocked(g));
  const done = games.filter((g) => g.status === "final").slice(0, 8);

  return (
    <>
      <PredHero
        back={false}
        kicker={<>Bout Predictions · players always play free</>}
        live
        wide
        title="Call the game. Call the score."
        sub={<>Pick the winner and the final score before the game starts. Call the winner for {SCORING.winner} points, then earn bonus points for nailing the score or getting close.</>}
      >
        <div className="pt-cta">
          <Link href="/predictions/new" className="pt-gold">Start a free game</Link>
          <Link href="/predictions/bracket/new" className="pt-ghost">Create a bracket</Link>
          <Link href="/predictions/private/new" className="pt-ghost">🔒 Private game · {money(BRACKET_PRICING.privateGameCents)}</Link>
          <Link href="/predictions/join" className="pt-ghost">Have a code?</Link>
          <Link href="/predictions/leaderboard" className="pt-ghost">Leaderboard</Link>
          <Link href="/predictions/play" className="pt-ghost">How it works</Link>
        </div>
      </PredHero>

      <div className="pt-body wide">
      <p className="pt-info mb-8">
        <strong>Players always play free.</strong> Organizers get one free single game a day (open 24 hours). A closed, invite-only private game is <b>{money(BRACKET_PRICING.privateGameCents)}</b> per game. A bracket with many games costs <b>{money(BRACKET_PRICING.weeklyCents)}</b> and stays open 8 days, or <b>{money(BRACKET_PRICING.seasonCents)}</b> to stay open all season.
      </p>

      <Section title="Open for picks" empty="No games are open right now. Create one to get your friends predicting!">
        {open.map((g) => <GameCard key={g.id} game={g} mine={mine[g.id]} />)}
      </Section>

      {live.length > 0 && (
        <Section title="In progress">{live.map((g) => <GameCard key={g.id} game={g} mine={mine[g.id]} />)}</Section>
      )}

      {(myPrivate ?? []).length > 0 && (
        <section className="mb-8">
          <h2 className="pt-h2 mb-3">Your private games</h2>
          <div className="grid gap-2">
            {(myPrivate ?? []).map((s) => (
              <Link key={s.id} href={`/predictions/slate/${s.id}`} className="bc-card flex items-center justify-between gap-3 p-4 text-sm font-bold">
                <span className="min-w-0 truncate">🔒 {s.title}</span>
                <span className="text-xs font-semibold" style={{ color: "var(--text-faint)" }}>{s.status === "pending" ? "Not paid yet" : s.status === "open" ? "Open" : "Closed"}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {(slateRows ?? []).length > 0 && (
        <section className="mb-8">
          <h2 className="pt-h2 mb-3">Brackets</h2>
          <div className="grid gap-2">
            {(slateRows ?? []).map((s) => (
              <Link key={s.id} href={`/predictions/slate/${s.id}`} className="bc-card flex items-center justify-between gap-3 p-4 text-sm font-bold">
                <span className="min-w-0">
                  <span className="block truncate">{s.title}</span>
                  <span className="block text-xs font-semibold" style={{ color: "var(--text-faint)" }}>
                    {s.kind === "elimination" ? "Elimination bracket" : "Slate of games"} · {s.status === "pending" ? "Not paid yet (only you can see this)" : s.status === "open" ? "Open" : "Closed"}
                  </span>
                </span>
                <span style={{ color: "var(--blue)" }}>View →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="pt-h2">This week&apos;s top predictors</h2>
          <Link href="/predictions/leaderboard" className="text-sm font-semibold" style={{ color: "var(--blue)" }}>Full board</Link>
        </div>
        <PredLeaderboardTable rows={(lb ?? []) as LeaderRow[]} meId={user?.id} />
      </section>

      {done.length > 0 && <Section title="Recent results">{done.map((g) => <GameCard key={g.id} game={g} mine={mine[g.id]} />)}</Section>}
      </div>
    </>
  );
}

function Section({ title, children, empty }: { title: string; children: React.ReactNode; empty?: string }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <section className="mb-8">
      <h2 className="pt-h2 mb-3">{title}</h2>
      {items.length === 0 && empty ? <p className="bc-card p-5 text-sm" style={{ color: "var(--text-dim)" }}>{empty}</p> : <div className="grid gap-3">{children}</div>}
    </section>
  );
}
