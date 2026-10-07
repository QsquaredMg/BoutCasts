import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PredTeam from "@/components/PredTeam";
import LocalTime from "@/components/LocalTime";
import PredictionForm from "@/components/PredictionForm";
import GameAdminPanel from "@/components/GameAdminPanel";
import WinnersGraphic from "@/components/WinnersGraphic";
import PredSponsorStrip from "@/components/PredSponsorStrip";
import CrowdSummary from "@/components/CrowdSummary";
import CrowdGraphic from "@/components/CrowdGraphic";
import type { CrowdStats } from "@/lib/predictions/crowd";
import ShareButton from "@/components/ShareButton";
import { GAME_FIELDS, hasPassed, isLocked, type PredGame, type PredPrediction } from "@/lib/predictions/types";

type Props = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Game not found" };
  const supabase = await createClient();
  const { data } = await supabase.from("pred_games").select("home_name, away_name, is_private").eq("id", id).maybeSingle();
  if (!data) return { title: "Game not found" };
  return {
    ...(data.is_private ? { robots: { index: false, follow: false } } : {}),
    title: `${data.home_name} vs ${data.away_name} prediction`,
    description: `Predict the winner and final score of ${data.home_name} vs ${data.away_name} before picks close and earn points on BoutCasts.`,
  };
}

export default async function GamePage({ params }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  const { data: row } = await supabase.from("pred_games").select(GAME_FIELDS).eq("id", id).maybeSingle();
  if (!row) notFound();
  const game = row as PredGame;

  const [{ data: picks }, { data: me }, { data: slate }] = await Promise.all([
    supabase.from("pred_predictions").select("id, game_id, user_id, pick, pred_home, pred_away, pts_entry, pts_winner, pts_exact, pts_close, pts_total, graded_at").eq("game_id", id).order("pts_total", { ascending: false, nullsFirst: false }).limit(200),
    user ? supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    game.slate_id ? supabase.from("pred_slates").select("id, title, brand_name, brand_logo_url, white_label").eq("id", game.slate_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const all = (picks ?? []) as PredPrediction[];
  const mine = all.find((p) => p.user_id === user?.id) ?? null;
  const crowdRes = game.round === null && game.status !== "cancelled" && isLocked(game) ? await supabase.rpc("pred_crowd_stats", { p_game: id }) : null;
  const crowd = (crowdRes?.data ?? null) as CrowdStats | null;
  let presenter: string | null = null;
  if (game.slate_id) {
    const { data: sp } = await supabase.rpc("get_pred_sponsors", { p_bracket: game.slate_id });
    presenter = ((sp ?? []) as { name: string; level: string }[]).find((x) => x.level === "title")?.name ?? null;
  }
  const canManage = !!user && (game.created_by === user.id || !!me?.is_admin);

  const ids = [...new Set(all.map((p) => p.user_id))];
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: profs } = await supabase.from("profiles").select("id, username").in("id", ids);
    for (const p of profs ?? []) names[p.id] = p.username ?? "Player";
  }

  const locked = isLocked(game);
  const bracketPick =
    game.round !== null && user
      ? ((await supabase.from("pred_bracket_picks").select("team_id, win_score, lose_score, pts_total").eq("game_id", id).eq("user_id", user.id).maybeSingle()).data as { team_id: string; win_score: number; lose_score: number; pts_total: number | null } | null)
      : null;
  const bracketPickTeam = bracketPick
    ? ((await supabase.from("pred_bracket_teams").select("name").eq("id", bracketPick.team_id).maybeSingle()).data?.name ?? "Team")
    : null;
  const final = game.status === "final";
  const graded = all.filter((p) => p.pts_total != null);
  const winners = graded.slice(0, 10).map((p) => ({
    name: names[p.user_id] ?? "Player",
    points: p.pts_total as number,
    detail: `Picked ${p.pred_home}–${p.pred_away}`,
  }));

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <Link href={slate ? `/predictions/slate/${slate.id}` : "/predictions"} className="mb-4 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>
        &larr; {slate ? slate.title : "Bout Predictions"}
      </Link>

      {slate && <PredSponsorStrip bracketId={slate.id} />}

      <div className="bc-card mb-5 p-5">
        <p className="mb-3 text-center text-xs font-bold" style={{ color: "var(--text-faint)" }}>
          {game.status === "cancelled" ? "Cancelled" : final ? "Final" : locked ? "In progress" : hasPassed(game.starts_at) ? "Started, picks still open" : "Starts"} · <LocalTime iso={game.starts_at} />
        </p>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          <PredTeam name={game.home_name} logo={game.home_logo} size={72} />
          <div className="text-center text-3xl font-black tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
            {final ? `${game.home_score} – ${game.away_score}` : "vs"}
          </div>
          <PredTeam name={game.away_name} logo={game.away_logo} size={72} />
        </div>
        <div className="mt-4 flex justify-center">
          <ShareButton imageUrl={`/predictions/${game.id}/vs`} title={`${game.home_name} vs ${game.away_name}`} text={`${game.home_name} vs ${game.away_name}: call the winner and the score on BoutCasts!`} />
        </div>
      </div>

      {game.status === "cancelled" ? (
        <p className="bc-card mb-5 p-5 text-center text-sm">This game was cancelled, so predictions will not be scored.</p>
      ) : game.round !== null && !locked ? (
        <div className="bc-card mb-5 p-5 text-center">
          <p className="mb-3 text-sm font-semibold">This game is part of a bracket. Fill out the whole bracket to predict it.</p>
          {slate && <Link href={`/predictions/slate/${slate.id}`} className="bc-btn-solid inline-block rounded-full px-5 py-2 text-sm font-bold">Open the bracket</Link>}
        </div>
      ) : !locked ? (
        <div className="mb-5">
          <PredictionForm game={game} signedIn={!!user} existing={mine ? { pred_home: mine.pred_home, pred_away: mine.pred_away } : null} />
        </div>
      ) : (
        <div className="bc-card mb-5 p-5 text-center">
          <p className="text-sm font-bold">{final ? "Final score is in." : "Picks are closed. Waiting for the final score."}</p>
          {bracketPick && (
            <p className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>
              Your pick: {bracketPickTeam} {bracketPick.win_score}–{bracketPick.lose_score}
              {bracketPick.pts_total != null && <><br /><strong style={{ color: "var(--blue)" }}>{bracketPick.pts_total} points</strong></>}
            </p>
          )}
          {mine && (
            <p className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>
              Your pick: {mine.pred_home} – {mine.pred_away}
              {mine.pts_total != null && (
                <>
                  <br />
                  <strong style={{ color: "var(--blue)" }}>{mine.pts_total} points</strong>
                  {" "}({mine.pts_entry ? `${mine.pts_entry} entry + ` : ""}{mine.pts_winner} winner + {mine.pts_exact} exact score + {mine.pts_close} close)
                </>
              )}
            </p>
          )}
          {!mine && !bracketPick && user && <p className="mt-2 text-sm" style={{ color: "var(--text-faint)" }}>You didn&apos;t enter a prediction for this game.</p>}
        </div>
      )}

      {canManage && <div className="mb-5"><GameAdminPanel game={game} isAdmin={!!me?.is_admin} /></div>}

      {final && graded.length > 0 && (
        <div className="mb-5">
          <WinnersGraphic
            title={`${game.home_name} ${game.home_score} – ${game.away_score} ${game.away_name}`}
            subtitle="Top predictors"
            winners={winners}
            homeLogo={game.home_logo}
            awayLogo={game.away_logo}
            brand={slate ? { name: slate.brand_name, logo: slate.brand_logo_url, whiteLabel: slate.white_label && !!(slate.brand_name || slate.brand_logo_url) } : null}
            fileName={`winners-${game.home_name}-vs-${game.away_name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
          />
        </div>
      )}

      {crowd?.locked && crowd.n ? <CrowdSummary stats={crowd} home={game.home_name} away={game.away_name} /> : null}

      {crowd?.locked && crowd.n ? (
        crowd.state === "ready" ? (
          <div className="mb-5">
            <CrowdGraphic
              stats={crowd}
              title={`${game.home_name} vs ${game.away_name}`}
              home={game.home_name}
              away={game.away_name}
              homeLogo={game.home_logo}
              awayLogo={game.away_logo}
              brand={slate ? { name: slate.brand_name, logo: slate.brand_logo_url, whiteLabel: slate.white_label && !!(slate.brand_name || slate.brand_logo_url) } : null}
              presenter={presenter}
            />
          </div>
        ) : (
          <p className="bc-card mb-5 p-4 text-center text-sm" style={{ color: "var(--text-dim)" }}>
            {crowd.state === "too_few"
              ? "The crowd graphic needs at least 5 predictions, so none was made for this game."
              : "The shareable crowd graphic appears here 5 minutes after picks close."}
          </p>
        )
      ) : null}

      {locked && all.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-3 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>Everyone&apos;s picks ({all.length})</h2>
          <ul className="bc-card divide-y overflow-hidden">
            {all.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm" style={{ borderColor: "var(--border)" }}>
                <span className="min-w-0 truncate font-bold">{names[p.user_id] ?? "Player"}</span>
                <span className="tabular-nums" style={{ color: "var(--text-dim)" }}>{p.pred_home} – {p.pred_away}</span>
                <span className="w-14 text-right font-black tabular-nums">{p.pts_total != null ? `${p.pts_total} pts` : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-xs" style={{ color: "var(--text-faint)" }}>
        {game.scoring_version === 1
          ? "Scoring: 2 for entering · 3 correct winner · 6 both scores exact (2 for one) · 2 if within 1–2 combined points, 1 if within 3–5."
          : "Scoring: 5 for the correct winner · 6 both scores exact (2 for one) · 2 if within 1–2 combined points, 1 if within 3–5."}
      </p>
    </div>
  );
}
