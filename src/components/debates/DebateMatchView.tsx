"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import DebateVideo from "@/components/debates/DebateVideo";
import DebateComposer from "@/components/debates/DebateComposer";
import {
  bracketRoundLabel,
  formatDuration,
  roundLabel,
  scoringLabel,
  SIDE_COLOR,
  SIDE_LABEL,
  timeLeft,
  type DebateMatch,
  type DebatePost,
  type DebateSide,
  type DebateTopic,
} from "@/lib/debates";

const GUEST_TOKEN_KEY = "bc_guest_vote_token";
function guestToken(): string {
  try {
    let t = localStorage.getItem(GUEST_TOKEN_KEY);
    if (!t) {
      t = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      localStorage.setItem(GUEST_TOKEN_KEY, t);
    }
    return t;
  } catch {
    return `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  }
}

type VoteState = {
  total: number;
  for: number | null;
  against: number | null;
  my_vote: DebateSide | null;
  guest_used_today: boolean;
  resets_at: string;
};

export default function DebateMatchView({ matchId }: { matchId: string }) {
  const supabase = createClient();
  const [match, setMatch] = useState<DebateMatch | null>(null);
  const [topic, setTopic] = useState<DebateTopic | null>(null);
  const [posts, setPosts] = useState<DebatePost[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [watchedBy, setWatchedBy] = useState<Set<string>>(new Set()); // "postId:userId"
  const [me, setMe] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bracketRounds, setBracketRounds] = useState(0);
  const [votes, setVotes] = useState<VoteState | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [openPost, setOpenPost] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const [{ data: u }, { data: m }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("debate_matches").select("*").eq("id", matchId).maybeSingle(),
    ]);
    if (!m) {
      setNotFound(true);
      return;
    }
    const uid = u.user?.id ?? null;
    setMe(uid);
    setMatch(m as DebateMatch);
    const [{ data: t }, { data: p }, { data: bm }, adminRow] = await Promise.all([
      supabase.from("debate_topics").select("*").eq("id", m.topic_id).maybeSingle(),
      supabase.from("debate_posts").select("*").eq("match_id", matchId).order("round").order("created_at"),
      supabase.from("debate_matches").select("bracket_round").eq("topic_id", m.topic_id).not("bracket_round", "is", null),
      uid ? supabase.from("profiles").select("is_admin").eq("id", uid).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setTopic(t as DebateTopic);
    setPosts((p ?? []) as DebatePost[]);
    const postIds = (p ?? []).map((x) => x.id);
    const { data: w } = postIds.length
      ? await supabase.from("debate_watches").select("post_id, user_id").eq("completed", true).in("post_id", postIds)
      : { data: [] as { post_id: string; user_id: string }[] };
    setWatchedBy(new Set((w ?? []).map((r) => `${r.post_id}:${r.user_id}`)));
    setBracketRounds(Math.max(0, ...(bm ?? []).map((r) => r.bracket_round ?? 0)));
    setIsAdmin(Boolean((adminRow.data as { is_admin?: boolean } | null)?.is_admin));
    const ids = [m.for_user_id, m.against_user_id].filter(Boolean) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username").in("id", ids);
      setNames(Object.fromEntries((profs ?? []).map((x) => [x.id, x.username ?? "Debater"])));
    }
    if (m.status === "voting" || m.status === "final") {
      const { data: vs } = await supabase.rpc("get_debate_vote_state", {
        p_match_id: matchId,
        p_guest_token: uid ? null : guestToken(),
      });
      setVotes(vs as VoteState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const poll = setInterval(load, 20000);
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  const mySide: DebateSide | null = useMemo(() => {
    if (!match || !me) return null;
    if (me === match.for_user_id) return "for";
    if (me === match.against_user_id) return "against";
    return null;
  }, [match, me]);

  // The opponent's most recent real video — what must be watched before replying.
  const mustWatch = useMemo(() => {
    if (!match || !mySide) return null;
    return (
      [...posts]
        .filter((p) => p.side !== mySide && p.source_type !== "missed")
        .sort((a, b) => b.round - a.round || b.created_at.localeCompare(a.created_at))[0] ?? null
    );
  }, [posts, match, mySide]);

  const onWatched = useCallback(
    async (seconds: number) => {
      if (!mustWatch || !me) return;
      const { data } = await supabase.rpc("mark_debate_watched", { p_post_id: mustWatch.id, p_seconds: seconds });
      if (data === true) setWatchedBy((prev) => new Set(prev).add(`${mustWatch.id}:${me}`));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mustWatch?.id, me]
  );

  async function vote(side: DebateSide) {
    setVoting(true);
    setMsg(null);
    const { error } = await supabase.rpc("cast_debate_vote", {
      p_match_id: matchId,
      p_side: side,
      p_guest_token: me ? null : guestToken(),
    });
    setVoting(false);
    if (error) {
      const m = error.message;
      setMsg(m.includes(":") && /^(guest_limit|already|closed):/.test(m) ? m.split(":").slice(1).join(":").trim() : m);
      return;
    }
    load();
  }

  async function adminAction(action: "close_voting" | "extend_turn") {
    const { error } = await supabase.rpc("admin_debate_action", { p_match_id: matchId, p_action: action });
    if (error) setMsg(error.message);
    load();
  }

  if (notFound) {
    return <p className="mx-auto max-w-2xl px-5 py-10" style={{ color: "var(--text-faint)" }}>This debate doesn&apos;t exist.</p>;
  }
  if (!match || !topic) {
    return <p className="mx-auto max-w-2xl px-5 py-10" style={{ color: "var(--text-faint)" }}>Loading debate…</p>;
  }

  const nameOf = (side: DebateSide) => {
    const id = side === "for" ? match.for_user_id : match.against_user_id;
    return id ? names[id] ?? "Debater" : "TBD";
  };
  const turnUser = match.turn_side === "for" ? match.for_user_id : match.against_user_id;
  const myTurn = match.status === "active" && me !== null && me === turnUser;
  const needsWatch = myTurn && mustWatch && !watchedBy.has(`${mustWatch.id}:${me}`);
  const showTally = votes && votes.for !== null;
  const crowdOpen = match.status === "voting" && topic.scoring_mode !== "judges";
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href={`/debates/${topic.id}`} className="mb-3 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>
        ← {topic.format === "bracket" ? "Bracket" : "All matches"}
      </Link>
      <p className="text-xs font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--red)" }}>
        Debate{match.bracket_round ? ` · ${bracketRoundLabel(match.bracket_round, bracketRounds)}` : ""} · {scoringLabel(topic)}
      </p>
      <h1 className="mb-4 text-3xl font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
        &ldquo;{topic.statement}&rdquo;
      </h1>

      {/* Debaters */}
      <div className="mb-4 grid grid-cols-2 gap-2.5">
        {(["for", "against"] as DebateSide[]).map((s) => {
          const won = match.winner_side === s;
          const strikes = s === "for" ? match.strikes_for : match.strikes_against;
          return (
            <div
              key={s}
              className="rounded-xl border p-3"
              style={{ borderColor: won ? SIDE_COLOR[s] : "var(--border)", background: "var(--surface)" }}
            >
              <p className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: SIDE_COLOR[s] }}>
                {SIDE_LABEL[s]} {won && "· Winner 🏆"}
              </p>
              <p className="truncate font-bold">{nameOf(s)}</p>
              {strikes > 0 && (
                <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {strikes} missed turn{strikes === 1 ? "" : "s"}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Status banner */}
      <div className="mb-5 rounded-xl p-3.5 text-sm" style={{ background: "#0a0e1a", color: "#fff" }}>
        {match.status === "waiting" && "Waiting for both debaters — winners from the previous round will fill this match."}
        {match.status === "active" && (
          <>
            <b>
              Round {match.current_round} of {topic.rounds} · {roundLabel(match.current_round, topic.rounds)}
            </b>
            <br />
            <span style={{ color: "#c9d0e0" }}>
              {SIDE_LABEL[match.turn_side]} ({nameOf(match.turn_side)}) is up — {timeLeft(match.turn_due_at, now)}
            </span>
          </>
        )}
        {match.status === "voting" && (
          <>
            <b>Voting is open</b> <span style={{ color: "#c9d0e0" }}>— closes {timeLeft(match.voting_closes_at, now)}</span>
          </>
        )}
        {match.status === "final" && match.winner_side && (
          <>
            <b>
              🏆 {nameOf(match.winner_side)} ({SIDE_LABEL[match.winner_side]}) wins
              {match.win_reason === "forfeit" ? " by forfeit" : ""}
            </b>
            {match.win_reason === "score" && (
              <span style={{ color: "#c9d0e0" }}>
                <br />
                {topic.scoring_mode !== "judges" && `Crowd ${match.crowd_for ?? 0}–${match.crowd_against ?? 0}`}
                {topic.scoring_mode === "both" && " · "}
                {topic.scoring_mode !== "crowd" && `Judges ${match.judge_for ?? 0}–${match.judge_against ?? 0} (avg of 40)`}
              </span>
            )}
          </>
        )}
      </div>

      {/* Debater action panel */}
      {myTurn && needsWatch && mustWatch && (
        <div className="mb-6 rounded-2xl border p-4" style={{ borderColor: "var(--red)", background: "var(--surface)" }}>
          <p className="text-xs font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--red)" }}>
            Your turn · step 1 of 2
          </p>
          <p className="mb-3 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Watch {nameOf(mustWatch.side)}&apos;s {roundLabel(mustWatch.round, topic.rounds).toLowerCase()} to unlock your reply
          </p>
          <DebateVideo post={mustWatch} onWatched={onWatched} />
          <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
            Watch it through ({formatDuration(mustWatch.duration_seconds)}). Skipping ahead doesn&apos;t count. Your reply unlocks
            automatically.
          </p>
        </div>
      )}
      {myTurn && !needsWatch && mySide && (
        <div className="mb-6">
          <DebateComposer
            matchId={match.id}
            roundName={roundLabel(match.current_round, topic.rounds)}
            sideName={SIDE_LABEL[mySide]}
            onPosted={load}
          />
        </div>
      )}
      {match.status === "active" && mySide && !myTurn && (
        <p className="mb-6 rounded-xl border p-3 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}>
          Waiting on {nameOf(match.turn_side)}. We&apos;ll notify you when it&apos;s your turn.
        </p>
      )}

      {/* Voting */}
      {crowdOpen && (
        <div className="mb-6 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="mb-1 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Who won the debate?
          </p>
          <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
            Watch both sides, then vote. {votes?.total ? `${votes.total} vote${votes.total === 1 ? "" : "s"} so far.` : ""}
          </p>
          {mySide ? (
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              You can&apos;t vote in your own debate — share it so people can!
            </p>
          ) : votes?.my_vote ? (
            <p className="text-sm font-semibold">
              ✓ You voted {SIDE_LABEL[votes.my_vote]} ({nameOf(votes.my_vote)}).
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {(["for", "against"] as DebateSide[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => vote(s)}
                  disabled={voting || (!me && votes?.guest_used_today)}
                  className="rounded-xl border-2 px-3 py-3 text-sm font-bold disabled:opacity-50"
                  style={{ borderColor: SIDE_COLOR[s], color: SIDE_COLOR[s] }}
                >
                  {SIDE_LABEL[s]}
                  <span className="block truncate text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                    {nameOf(s)}
                  </span>
                </button>
              ))}
            </div>
          )}
          {!me && (
            <p className="mt-3 text-xs" style={{ color: "var(--text-faint)" }}>
              Guests get 1 free debate vote a day.{" "}
              <Link href={`/signup?next=${encodeURIComponent(`/debates/match/${match.id}`)}`} className="font-semibold underline" style={{ color: "var(--red)" }}>
                Create a free account
              </Link>{" "}
              to vote in every debate.
            </p>
          )}
        </div>
      )}
      {match.status === "voting" && topic.scoring_mode === "judges" && (
        <p className="mb-6 rounded-xl border p-3 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}>
          The judges are scoring this debate. Results post when judging closes {timeLeft(match.voting_closes_at, now)}.
        </p>
      )}
      {showTally && match.status !== "final" && votes && (
        <p className="-mt-3 mb-6 text-xs" style={{ color: "var(--text-faint)" }}>
          Live tally: For {votes.for} · Against {votes.against}
        </p>
      )}
      {msg && (
        <p className="mb-4 text-sm" style={{ color: "var(--danger)" }}>
          {msg}
        </p>
      )}

      {/* Timeline */}
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
        The debate
      </h2>
      <div className="flex flex-col gap-5">
        {Array.from({ length: topic.rounds }, (_, i) => i + 1).map((r) => (
          <div key={r}>
            <p className="mb-2 text-sm font-bold">
              {r}. {roundLabel(r, topic.rounds)}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["for", "against"] as DebateSide[]).map((s) => {
                const p = posts.find((x) => x.round === r && x.side === s);
                const oppId = s === "for" ? match.against_user_id : match.for_user_id;
                const isUpNext = match.status === "active" && match.current_round === r && match.turn_side === s;
                return (
                  <div key={s} className="rounded-xl border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                    <p className="mb-1.5 flex items-center justify-between text-xs font-bold">
                      <span style={{ color: SIDE_COLOR[s] }}>
                        {SIDE_LABEL[s]} · {nameOf(s)}
                      </span>
                      {p && p.source_type !== "missed" && (
                        <span style={{ color: "var(--text-faint)" }}>{formatDuration(p.duration_seconds)}</span>
                      )}
                    </p>
                    {p ? (
                      openPost === p.id || p.source_type === "missed" ? (
                        <DebateVideo post={p} />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setOpenPost(p.id)}
                          className="flex aspect-video w-full items-center justify-center rounded-xl text-sm font-bold text-white"
                          style={{ background: "#0a0e1a" }}
                        >
                          ▶ Play
                        </button>
                      )
                    ) : (
                      <div
                        className="flex aspect-video w-full items-center justify-center rounded-xl text-xs"
                        style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}
                      >
                        {isUpNext ? `Up next · ${timeLeft(match.turn_due_at, now)}` : "Not yet"}
                      </div>
                    )}
                    {p && p.source_type !== "missed" && oppId && watchedBy.has(`${p.id}:${oppId}`) && (
                      <p className="mt-1 text-[11px] font-semibold" style={{ color: "var(--text-faint)" }}>
                        ✓ Watched by opponent
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(shareUrl);
            setMsg("Link copied!");
          }}
          className="rounded-full border px-4 py-2 text-sm font-bold"
          style={{ borderColor: "var(--border)" }}
        >
          Copy link to share
        </button>
        {isAdmin && match.status === "voting" && (
          <button type="button" onClick={() => adminAction("close_voting")} className="rounded-full border px-4 py-2 text-sm font-bold" style={{ borderColor: "var(--border)" }}>
            Close voting now (admin)
          </button>
        )}
        {isAdmin && match.status === "active" && (
          <button type="button" onClick={() => adminAction("extend_turn")} className="rounded-full border px-4 py-2 text-sm font-bold" style={{ borderColor: "var(--border)" }}>
            Give +24h on this turn (admin)
          </button>
        )}
      </div>
    </div>
  );
}
