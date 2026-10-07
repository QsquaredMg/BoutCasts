import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GameCard from "@/components/GameCard";
import PredLeaderboardTable from "@/components/PredLeaderboardTable";
import WinnersGraphic from "@/components/WinnersGraphic";
import ShareButton from "@/components/ShareButton";
import BracketOwnerPanel from "@/components/BracketOwnerPanel";
import EliminationBracket, { type BracketPick } from "@/components/EliminationBracket";
import PredSponsorStrip from "@/components/PredSponsorStrip";
import PredSponsorManager from "@/components/PredSponsorManager";
import PredBrandingEditor from "@/components/PredBrandingEditor";
import LocalTime from "@/components/LocalTime";
import { GAME_FIELDS, SLATE_FIELDS, hasPassed, type BracketTeam, type LeaderRow, type PredGame, type PredSlate } from "@/lib/predictions/types";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ checkout?: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Bracket not found" };
  const supabase = await createClient();
  const { data } = await supabase.from("pred_slates").select("title, kind, visibility").eq("id", id).maybeSingle();
  if (!data) return { title: "Bracket not found" };
  return {
    title: data.title,
    ...(data.visibility === "private" ? { robots: { index: false, follow: false } } : {}),
    description: `${data.kind === "elimination" ? "Fill out the bracket" : "Weekly pick'em"}: predict every winner and score in ${data.title} for free and compete on the leaderboard.`,
  };
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

  const [{ data: gameRows }, { data: lb }, { data: teamRows }, { data: me }, { data: sponsorRows }] = await Promise.all([
    supabase.from("pred_games").select(GAME_FIELDS).eq("slate_id", id).neq("status", "cancelled").order("starts_at"),
    supabase.rpc("pred_leaderboard", { p_scope: "season", p_slate: id, p_limit: 25 }),
    isElim ? supabase.from("pred_bracket_teams").select("id, seed, name, logo").eq("bracket_id", id).order("seed") : Promise.resolve({ data: [] }),
    user ? supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.rpc("get_pred_sponsors", { p_bracket: id }),
  ]);
  const presenter = ((sponsorRows ?? []) as { name: string; level: string }[]).find((x) => x.level === "title")?.name ?? null;
  const whiteLabel = slate.white_label && !!(slate.brand_name || slate.brand_logo_url);
  const games = (gameRows ?? []) as PredGame[];
  const rows = (lb ?? []) as LeaderRow[];
  const teams = (teamRows ?? []) as BracketTeam[];
  const isOwner = !!user && (user.id === slate.created_by || !!me?.is_admin);
  const open = slate.status === "open" && (!slate.closes_at || !hasPassed(slate.closes_at));
  const beforeLock = !!slate.locks_at && !hasPassed(slate.locks_at);
  const canPredict = isElim && open && beforeLock;
  const finals = games.filter((g) => g.status === "final").length;
  const allFinal = games.length > 0 && finals === games.length;

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
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/predictions" className="mb-4 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>&larr; Bout Predictions</Link>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--blue)" }}>
        {slate.visibility === "private" ? "🔒 Private game" : isElim ? `${slate.bracket_size}-team bracket` : "Weekly slate"} · {statusText}
      </p>
      {(slate.brand_name || slate.brand_logo_url) && (
        <div className="mb-3 flex items-center gap-3" style={slate.brand_color ? { borderLeft: `4px solid ${slate.brand_color}`, paddingLeft: 12 } : undefined}>
          {slate.brand_logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slate.brand_logo_url} alt={slate.brand_name ?? "Host logo"} className="h-12 max-w-[160px] object-contain" />
          )}
          {slate.brand_name && <span className="text-sm font-bold" style={{ color: "var(--text-dim)" }}>{whiteLabel ? slate.brand_name : `Hosted by ${slate.brand_name}`}</span>}
        </div>
      )}
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{slate.title}</h1>
      <p className="mb-4 text-sm" style={{ color: "var(--text-faint)" }}>
        {games.length} {games.length === 1 ? "game" : "games"} · {finals} final · points add up across the whole {isElim ? "bracket" : "slate"}
        {isElim && slate.locks_at && beforeLock ? <> · picks lock <LocalTime iso={slate.locks_at} /></> : null}
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {isOwner && !isElim && open && (
          <Link href={`/predictions/new?slate=${slate.id}`} className="bc-btn-solid rounded-full px-5 py-2.5 text-sm font-bold">Add a game</Link>
        )}
        {slate.status !== "pending" && <ShareButton title={slate.title} text={`${slate.title}: make your picks on BoutCasts!`} imageUrl={`/predictions/slate/${slate.id}/vs`} />}
      </div>

      {slate.status !== "pending" && <PredSponsorStrip bracketId={slate.id} />}

      {isOwner && <BracketOwnerPanel slate={slate} justPaid={checkout === "success"} isAdmin={!!me?.is_admin} gameCount={games.length} />}

      {isOwner && slate.status !== "pending" && (
        <div className="mb-6 grid gap-3">
          <PredBrandingEditor slate={slate} />
          <PredSponsorManager bracketId={slate.id} />
        </div>
      )}

      {isElim ? (
        <EliminationBracket slate={slate} teams={teams} games={games} myPicks={myPicks} canPredict={canPredict} signedIn={!!user} />
      ) : (
        <section className="mb-8 grid gap-3">
          {games.length === 0 ? <p className="bc-card p-5 text-sm" style={{ color: "var(--text-dim)" }}>No games have been added yet.</p> : games.map((g) => <GameCard key={g.id} game={g} mine={mine[g.id]} />)}
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>Leaderboard</h2>
        <PredLeaderboardTable rows={rows} meId={user?.id} />
      </section>

      {rows.length > 0 && (
        <WinnersGraphic
          title={slate.title}
          subtitle={allFinal ? "Final winners" : `Leaders after ${finals} of ${games.length} games`}
          winners={rows.slice(0, 10).map((r) => ({ name: r.username ?? "Player", points: Number(r.points), detail: `${r.games} games · ${r.perfect} perfect` }))}
          brand={{ name: slate.brand_name, logo: slate.brand_logo_url, whiteLabel }}
          presenter={presenter}
          fileName={`winners-${slate.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
        />
      )}
    </div>
  );
}
