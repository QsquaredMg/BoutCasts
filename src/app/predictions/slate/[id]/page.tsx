import { cardMetadata } from "@/lib/og/cardRoute";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GameCard from "@/components/GameCard";
import PredLeaderboardTable from "@/components/PredLeaderboardTable";
import TourneyLeaderboard from "@/components/TourneyLeaderboard";
import WinnersGraphic from "@/components/WinnersGraphic";
import PredHero from "@/components/PredHero";
import ShareButton from "@/components/ShareButton";
import BracketOwnerPanel from "@/components/BracketOwnerPanel";
import EliminationBracket, { type BracketPick } from "@/components/EliminationBracket";
import PredSponsorStrip from "@/components/PredSponsorStrip";
import PredSponsorManager from "@/components/PredSponsorManager";
import PredBrandingEditor from "@/components/PredBrandingEditor";
import LocalTime from "@/components/LocalTime";
import { GAME_FIELDS, SLATE_FIELDS, hasPassed, type BracketTeam, type LeaderRow, type PredGame, type PredSlate, type TourneyRow } from "@/lib/predictions/types";
import { roundLabel, roundPoints } from "@/lib/predictions/pricing";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ checkout?: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Bracket not found" };
  const supabase = await createClient();
  const { data } = await supabase.from("pred_slates").select("title, kind, visibility").eq("id", id).maybeSingle();
  if (!data) return { title: "Bracket not found" };
  return cardMetadata("predictions-slate", id, data.title, data.visibility === "private" ? { robots: { index: false, follow: false } } : {});
}

export default async function SlatePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { checkout } = await searchParams;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  const { data: slateRow } = await supabase.from("pred_slates").select(SLATE_FIELDS).eq("id", id).maybeSingle();
  if (!slateRow) notFound();
  const slate = slateRow as PredSlate;
  const isElim = slate.kind === "elimination";
  const isTourney = slate.scoring_mode === "tourney";
  const isVotes = slate.advance_mode === "votes";

  const [{ data: gameRows }, { data: lb }, { data: teamRows }, { data: me }, { data: sponsorRows }, { data: entrantStand }] = await Promise.all([
    supabase.from("pred_games").select(GAME_FIELDS).eq("slate_id", id).neq("status", "cancelled").order("starts_at"),
    isTourney ? supabase.rpc("tourney_leaderboard", { p_slate: id, p_limit: 100 }) : supabase.rpc("pred_leaderboard", { p_scope: "season", p_slate: id, p_limit: 25 }),
    isElim ? supabase.from("pred_bracket_teams").select("id, seed, name, logo").eq("bracket_id", id).order("seed") : Promise.resolve({ data: [] }),
    user ? supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.rpc("get_pred_sponsors", { p_bracket: id }),
    isTourney || isElim ? Promise.resolve({ data: [] }) : supabase.rpc("pred_entrant_standings", { p_slate: id }),
  ]);
  const presenter = ((sponsorRows ?? []) as { name: string; level: string }[]).find((x) => x.level === "title")?.name ?? null;
  const whiteLabel = slate.white_label && !!(slate.brand_name || slate.brand_logo_url);
  const games = (gameRows ?? []) as PredGame[];
  const tourneyRows = isTourney ? ((lb ?? []) as TourneyRow[]) : [];
  const rows: LeaderRow[] = isTourney
    ? tourneyRows.map((r) => ({ user_id: r.user_id, username: r.username, avatar_url: r.avatar_url, points: Number(r.points), games: Number(r.wins) + Number(r.losses), winners: Number(r.wins), perfect: 0 }))
    : [
        ...((lb ?? []) as LeaderRow[]),
        // People the organizer entered picks for, ranked alongside signed-in players.
        ...((entrantStand ?? []) as { entrant_name: string; points: number; games: number; winners: number; perfect: number }[]).map((e): LeaderRow => ({
          user_id: `entrant:${e.entrant_name.toLowerCase()}`, display_name: e.entrant_name, username: null, avatar_url: null,
          points: Number(e.points), games: Number(e.games), winners: Number(e.winners), perfect: Number(e.perfect),
        })),
      ].sort((a, b) => Number(b.points) - Number(a.points) || Number(b.perfect) - Number(a.perfect) || Number(b.winners) - Number(a.winners));
  const teams = (teamRows ?? []) as BracketTeam[];
  const isOwner = !!user && (user.id === slate.created_by || !!me?.is_admin);
  const open = slate.status === "open" && (!slate.closes_at || !hasPassed(slate.closes_at));
  const beforeLock = !!slate.locks_at && !hasPassed(slate.locks_at);
  const canPredict = isElim && open && beforeLock;
  const finals = games.filter((g) => g.status === "final").length;
  const allFinal = games.length > 0 && finals === games.length;
  const totalRounds = Math.max(...games.map((g) => g.round ?? 1), 1);

  // Crowd-votes brackets: the vote tally per matchup, and this person's own votes.
  const voteCounts: Record<string, Record<string, number>> = {};
  const myVotes: Record<string, string> = {};
  if (isVotes) {
    const [{ data: vc }, { data: mv }] = await Promise.all([
      supabase.rpc("bracket_vote_counts", { p_slate: id }),
      user ? supabase.rpc("bracket_my_votes", { p_slate: id }) : Promise.resolve({ data: [] }),
    ]);
    for (const r of (vc ?? []) as { game_id: string; team_id: string; votes: number }[]) (voteCounts[r.game_id] ??= {})[r.team_id] = Number(r.votes);
    for (const r of (mv ?? []) as { game_id: string; team_id: string }[]) myVotes[r.game_id] = r.team_id;
  }

  let myPicks: BracketPick[] = [];
  const mine: Record<string, { pred_home: number; pred_away: number; pts_total: number | null }> = {};
  if (user && games.length) {
    if (isElim) {
      const { data } = await supabase.from("pred_bracket_picks").select("game_id, team_id, win_score, lose_score, pts_total").eq("bracket_id", id).eq("user_id", user.id);
      myPicks = (data ?? []) as BracketPick[];
    } else {
      const { data: picks } = await supabase.from("pred_predictions").select("game_id, pred_home, pred_away, pts_total").eq("user_id", user.id).in("game_id", games.map((g) => g.id));
      for (const p of picks ?? []) mine[p.game_id] = p;
    }
  }

  const statusText =
    slate.status === "pending" ? "Not open yet" : open ? (slate.closes_at ? "Open" : "Open all season") : "Closed to new predictions";

  return (
    <>
      <PredHero
        wide
        backLabel="Bout Predictions"
        kicker={<>{slate.visibility === "private" ? "🔒 Private pool" : isElim ? `${slate.bracket_size}-${isVotes ? "contestant" : "team"} bracket${isVotes ? " · advances by crowd vote" : ""}` : "Weekly pick'em"} · {statusText}</>}
        live={open}
        title={slate.title}
        sub={<>
          {games.length} {games.length === 1 ? "game" : "games"} · {finals} final · points add up across the whole {isElim ? "bracket" : "slate"}
          {isElim && slate.locks_at && beforeLock ? <> · picks lock <LocalTime iso={slate.locks_at} withYear /></> : null}
        </>}
      >
        {(slate.brand_name || slate.brand_logo_url) && (
          <div className="mt-4 flex items-center gap-3" style={slate.brand_color ? { borderLeft: `4px solid ${slate.brand_color}`, paddingLeft: 12 } : undefined}>
            {slate.brand_logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={slate.brand_logo_url} alt={slate.brand_name ?? "Host logo"} className="h-12 max-w-[160px] rounded-lg bg-white object-contain p-1" />
            )}
            {slate.brand_name && <span className="text-sm font-bold" style={{ color: "#cdd6f5" }}>{whiteLabel ? slate.brand_name : `Hosted by ${slate.brand_name}`}</span>}
          </div>
        )}
        <div className="pt-cta">
          {isVotes && open && <a href="#bracket" className="pt-gold">Vote on matchups</a>}
          {isOwner && !isElim && open && (
            <Link href={`/predictions/new?slate=${slate.id}`} className="pt-gold">Add a game</Link>
          )}
          {slate.status !== "pending" && <ShareButton title={slate.title} text={`${slate.title}: make your picks on BoutCasts!`} imageUrl={`/predictions/slate/${slate.id}/vs`} />}
        </div>
      </PredHero>

      <div className="pt-body wide">
      {slate.status !== "pending" && <PredSponsorStrip bracketId={slate.id} />}

      {isOwner && <BracketOwnerPanel slate={slate} justPaid={checkout === "success"} isAdmin={!!me?.is_admin} gameCount={games.length} />}

      {isOwner && slate.status !== "pending" && (
        <div className="mb-6 grid gap-3">
          <PredBrandingEditor slate={slate} />
          <PredSponsorManager bracketId={slate.id} />
        </div>
      )}

      {isElim ? (
        <div id="bracket">
          <EliminationBracket slate={slate} teams={teams} games={games} myPicks={myPicks} canPredict={canPredict} signedIn={!!user} isOwner={isOwner} voteCounts={voteCounts} myVotes={myVotes} />
        </div>
      ) : (
        <section className="mb-8 grid gap-3">
          {games.length === 0 ? <p className="bc-card p-5 text-sm" style={{ color: "var(--text-dim)" }}>No games have been added yet.</p> : games.map((g) => <GameCard key={g.id} game={g} mine={mine[g.id]} />)}
        </section>
      )}

      {isTourney && (
        <section className="bc-card mb-6 p-4 text-sm">
          <h2 className="pt-h2 mb-2">How points work</h2>
          <p className="mb-2" style={{ color: "var(--text-dim)" }}>
            {isVotes
              ? "Every correct pick earns points, and later rounds are worth more. A matchup is decided by the crowd's votes, and players with the same points are ranked by who entered first."
              : "Every correct pick earns points, and later rounds are worth more. Wins and losses decide the standings. The championship score guess only breaks ties."}
          </p>
          <p className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
            {Array.from({ length: totalRounds }, (_, i) => `${roundLabel(i + 1, totalRounds)}: ${roundPoints(i + 1)}`).join(" · ")}
          </p>
        </section>
      )}

      <section className="mb-8">
        <h2 className="pt-h2 mb-3">Leaderboard</h2>
        {isTourney ? (
          <TourneyLeaderboard rows={tourneyRows} meId={user?.id} champFinal={games.some((g) => g.round === totalRounds && g.status === "final")} />
        ) : (
          <PredLeaderboardTable rows={rows} meId={user?.id} />
        )}
      </section>

      {rows.length > 0 && (
        <WinnersGraphic
          title={slate.title}
          subtitle={allFinal ? "Final winners" : `Leaders after ${finals} of ${games.length} games`}
          winners={rows.slice(0, 10).map((r) => ({ name: r.username ?? r.display_name ?? "Player", points: Number(r.points), detail: isTourney ? `${r.winners}-${r.games - r.winners} record` : `${r.games} games · ${r.perfect} perfect` }))}
          brand={{ name: slate.brand_name, logo: slate.brand_logo_url, whiteLabel }}
          presenter={presenter}
          fileName={`winners-${slate.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
        />
      )}
      </div>
    </>
  );
}
