"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LocalTime from "@/components/LocalTime";
import PredTeam from "@/components/PredTeam";
import EmbeddedClipPlayer from "@/components/EmbeddedClipPlayer";
import { getEmbedInfo } from "@/lib/clipSource";
import { useNow } from "@/lib/predictions/useNow";
import type { BracketTeam, PredGame } from "@/lib/predictions/types";

// One matchup in a crowd-votes bracket: vote buttons while voting is open, the split once you have voted
// or it closes, and the organizer's "close now" / tie-break controls.
export default function BracketVotePanel({
  game,
  teams,
  counts,
  myVote,
  signedIn,
  isOwner,
  loginHref,
}: {
  game: PredGame;
  teams: Map<string, BracketTeam>;
  counts: Record<string, number>;
  myVote: string | null;
  signedIn: boolean;
  isOwner: boolean;
  loginHref: string;
}) {
  const router = useRouter();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [askTie, setAskTie] = useState(false);
  const [watching, setWatching] = useState<string | null>(null);

  const homeId = game.home_team_id, awayId = game.away_team_id;
  const ready = !!homeId && !!awayId;
  const final = game.status === "final";
  const opensMs = new Date(game.starts_at).getTime();
  const closesMs = game.votes_close_at ? new Date(game.votes_close_at).getTime() : null;
  const hydrated = now !== 0;
  const notOpen = ready && !final && hydrated && now < opensMs;
  const open = ready && !final && hydrated && now >= opensMs && closesMs !== null && now < closesMs;
  const closedWaiting = ready && !final && hydrated && closesMs !== null && now >= closesMs;

  const home = homeId ? counts[homeId] ?? 0 : 0;
  const away = awayId ? counts[awayId] ?? 0 : 0;
  const total = home + away;
  const tied = home === away;
  const showSplit = final || closedWaiting || !!myVote || isOwner;
  const winnerId = game.winner_team_id;

  async function vote(teamId: string) {
    setBusy(true);
    setMsg(null);
    const { error } = await createClient().rpc("cast_bracket_vote", { p_game: game.id, p_team: teamId });
    setBusy(false);
    if (error) setMsg(error.message);
    else router.refresh();
  }

  async function close(winner: string | null) {
    setBusy(true);
    setMsg(null);
    const { data, error } = await createClient().rpc("close_bracket_vote_game", { p_game: game.id, p_winner: winner });
    setBusy(false);
    if (error) setMsg(error.message);
    else if (data === "tie") {
      setAskTie(true);
      setMsg("It's a tie. Choose who advances.");
    }
    else router.refresh();
  }

  function side(id: string | null, name: string, logo: string | null, n: number) {
    const t = id ? teams.get(id) : undefined;
    const on = myVote === id;
    const won = final && winnerId === id;
    const pct = total ? Math.round((n / total) * 100) : 0;
    const canVote = open && !!id && signedIn;
    const content = (
      <>
        <PredTeam name={t?.name ?? name} logo={t?.logo ?? logo} size={44} />
        {showSplit && (
          <span className="mt-1 block text-center text-xs font-bold tabular-nums" style={{ color: "var(--text-dim)" }}>
            {n} {n === 1 ? "vote" : "votes"}{total ? ` · ${pct}%` : ""}
          </span>
        )}
        {won && <span className="mt-1 block text-center text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--blue)" }}>Advances</span>}
        {on && !won && <span className="mt-1 block text-center text-[11px] font-bold" style={{ color: "var(--blue)" }}>Your vote</span>}
      </>
    );
    const style = { borderColor: on || won ? "var(--blue)" : "var(--border)", background: on || won ? "var(--surface-2)" : "transparent", boxShadow: on || won ? "0 0 0 1px var(--blue)" : undefined };
    return canVote ? (
      <button type="button" disabled={busy} onClick={() => vote(id!)} aria-pressed={on} className="min-w-0 rounded-xl border p-2 disabled:opacity-60" style={style}>{content}</button>
    ) : (
      <div className="min-w-0 rounded-xl border p-2" style={style}>{content}</div>
    );
  }

  const clipOf = (id: string | null) => (id ? teams.get(id)?.clip_url ?? null : null);
  const watchBtn = (id: string | null) => {
    const clip = clipOf(id);
    if (!clip) return <span />;
    const on = watching === id;
    return (
      <button type="button" onClick={() => setWatching(on ? null : id)} aria-expanded={on} className="mt-1 w-full rounded-full border px-2 py-1 text-xs font-bold" style={{ borderColor: "var(--border)" }}>
        {on ? "Hide clip" : "▶ Watch clip"}
      </button>
    );
  };
  const playing = watching ? clipOf(watching) : null;

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0">{side(homeId, game.home_name, game.home_logo, home)}{watchBtn(homeId)}</div>
        <div className="min-w-0">{side(awayId, game.away_name, game.away_logo, away)}{watchBtn(awayId)}</div>
      </div>
      {playing && (
        <div className="mt-2">
          <p className="mb-1 text-xs font-bold" style={{ color: "var(--text-dim)" }}>{teams.get(watching!)?.name}</p>
          {getEmbedInfo(playing) ? (
            <EmbeddedClipPlayer sourceUrl={playing} label={`${teams.get(watching!)?.name ?? "Contestant"} clip`} />
          ) : (
            <video src={playing} controls playsInline preload="metadata" className="w-full rounded-xl" style={{ background: "#000" }} />
          )}
        </div>
      )}

      <p className="mt-2 text-center text-xs" style={{ color: "var(--text-faint)" }}>
        {!ready && "Waiting on the earlier round."}
        {notOpen && <>Voting opens <LocalTime iso={game.starts_at} />.</>}
        {open && (
          <>
            {signedIn ? (myVote ? "You can change your vote until " : "Tap a contestant to vote. Voting closes ") : "Voting closes "}
            {game.votes_close_at && <LocalTime iso={game.votes_close_at} />}.
          </>
        )}
        {closedWaiting && (tied ? "Voting is closed and the vote is tied." : "Voting is closed. The winner advances within the hour.")}
        {final && `Final: ${game.home_score}–${game.away_score}${game.home_score === game.away_score ? " (tied, organizer chose)" : ""}`}
      </p>

      {open && !signedIn && (
        <p className="mt-2 text-center text-sm">
          <a href={loginHref} className="font-bold underline" style={{ color: "var(--blue)" }}>Sign in to vote</a>
        </p>
      )}

      {isOwner && ready && !final && hydrated && now >= opensMs && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {tied && (closedWaiting || askTie) && (
            <>
              <span className="w-full text-center text-xs font-bold">Tied. You choose who advances:</span>
              {[homeId, awayId].map((id) => (
                <button key={id} type="button" disabled={busy} onClick={() => close(id)} className="bc-btn-solid rounded-full px-4 py-2 text-xs font-bold disabled:opacity-60">
                  {teams.get(id!)?.name ?? "Advance"}
                </button>
              ))}
            </>
          )}
          {!(tied && (closedWaiting || askTie)) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!open || window.confirm("Close voting on this matchup now? The contestant with more votes advances.")) close(null);
              }}
              className="rounded-full border px-4 py-2 text-xs font-bold disabled:opacity-60"
              style={{ borderColor: "var(--border)" }}
            >
              {open ? "Close voting now" : "Advance the winner now"}
            </button>
          )}
        </div>
      )}
      {msg && <p role="status" className="mt-2 text-center text-xs font-semibold" style={{ color: "var(--red)" }}>{msg}</p>}
    </div>
  );
}
