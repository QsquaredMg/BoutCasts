"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ClipPlayer from "@/components/ClipPlayer";
import EmbeddedClipPlayer from "@/components/EmbeddedClipPlayer";
import AdBanner from "@/components/AdBanner";
import ShareButton from "@/components/ShareButton";
import RankedResults from "@/components/RankedResults";
import JudgedResults from "@/components/JudgedResults";
import DemographicsPrompt from "@/components/DemographicsPrompt";
import EventSponsorStrip from "@/components/EventSponsorStrip";
import { displayClip } from "@/lib/liveVoteEvents/displayClip";

type EventStatus = "draft" | "live" | "closed";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  voter_mode: "account" | "open_link";
  status: EventStatus;
  closes_at: string | null;
  brand_name: string | null;
  brand_logo_url: string | null;
  ads_enabled: boolean;
  post_vote_graphic_url: string | null;
  voting_method: "single" | "ranked";
  scoring_mode: "crowd" | "judges";
  collect_demographics: boolean;
};

type OptionRow = {
  id: string;
  name: string;
  source_type: string;
  source_url: string | null;
  sort_order: number;
  description: string | null;
  thumbnail_url: string | null;
};

const VOTER_TOKEN_KEY = "bc_live_vote_voter_token";

function getOrCreateVoterToken(): string {
  try {
    const existing = window.localStorage.getItem(VOTER_TOKEN_KEY);
    if (existing) return existing;
    const token = crypto.randomUUID();
    window.localStorage.setItem(VOTER_TOKEN_KEY, token);
    return token;
  } catch {
    // localStorage unavailable (private mode, etc.) — fall back to a
    // session-only token. Voting still works, it just won't be remembered
    // as "already voted" on a page reload.
    return crypto.randomUUID();
  }
}

export default function LiveVoteBallot({ eventId }: { eventId: string }) {
  const supabase = createClient();
  const voterTokenRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [tally, setTally] = useState<Record<string, number>>({});
  const [myVote, setMyVote] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Ranked-choice: the ballot being built, the submitted ranking, and a
  // counter that tells the runoff results to re-fetch.
  const [draftRanking, setDraftRanking] = useState<string[]>([]);
  const [myRanking, setMyRanking] = useState<string[] | null>(null);
  const [submittingRanking, setSubmittingRanking] = useState(false);
  const [resultsKey, setResultsKey] = useState(0);
  // null = not checked yet; true = answered or skipped (hide the prompt)
  const [demoDone, setDemoDone] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    setSignedIn(!!user);

    const { data: eventRow } = await supabase
      .from("live_vote_events")
      .select("id, title, description, voter_mode, status, closes_at, brand_name, brand_logo_url, post_vote_graphic_url, ads_enabled, voting_method, scoring_mode, collect_demographics")
      .eq("id", eventId)
      .maybeSingle();

    if (!eventRow) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setEvent(eventRow);

    const { data: optionRows } = await supabase
      .from("live_vote_options")
      .select("id, name, source_type, source_url, sort_order, description, thumbnail_url")
      .eq("event_id", eventId)
      .order("sort_order");
    setOptions(optionRows ?? []);

    const { data: tallyRows } = await supabase.rpc("get_live_vote_tally", { p_event_id: eventId });
    const nextTally: Record<string, number> = {};
    for (const row of tallyRows ?? []) {
      nextTally[row.option_id] = Number(row.votes);
    }
    setTally(nextTally);

    if (eventRow.voting_method === "ranked") {
      let token: string | null = null;
      if (eventRow.voter_mode === "open_link") {
        token = getOrCreateVoterToken();
        voterTokenRef.current = token;
      }
      if (eventRow.voter_mode === "open_link" || user) {
        const { data: ranking } = await supabase.rpc("get_my_live_vote_ranking", {
          p_event_id: eventId,
          p_voter_token: token,
        });
        const r = (ranking as string[] | null) ?? null;
        setMyRanking(r && r.length > 0 ? r : null);
        setMyVote(r && r.length > 0 ? r[0] : null);
      }
    } else if (eventRow.voter_mode === "open_link" || user) {
      // Individual votes aren't publicly readable, so look up "my vote"
      // through the private helper (matches the signed-in account or this
      // browser's voter token).
      let token: string | null = null;
      if (eventRow.voter_mode === "open_link") {
        token = getOrCreateVoterToken();
        voterTokenRef.current = token;
      }
      const { data: mine } = await supabase.rpc("get_my_live_vote_ranking", {
        p_event_id: eventId,
        p_voter_token: token,
      });
      const r = (mine as string[] | null) ?? null;
      setMyVote(r && r.length > 0 ? r[0] : null);
    }

    if (eventRow.collect_demographics) {
      const { data: answered } = await supabase.rpc("has_answered_live_vote_demographics", {
        p_event_id: eventId,
        p_voter_token: voterTokenRef.current,
      });
      setDemoDone(Boolean(answered));
    }

    setLoading(false);
  }, [supabase, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`live-vote-tally-${eventId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_vote_tally_feed", filter: `event_id=eq.${eventId}` },
        (payload) => {
          const optionId = (payload.new as { option_id: string }).option_id;
          setTally((prev) => ({ ...prev, [optionId]: (prev[optionId] ?? 0) + 1 }));
        }
      )
      .subscribe();

    // Safety net: if the realtime connection drops (spotty stadium Wi-Fi,
    // a phone waking from sleep), re-sync the tally and event status every
    // 10 seconds so the big screen never freezes on an old count.
    const poll = setInterval(async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const { data: tallyRows } = await supabase.rpc("get_live_vote_tally", { p_event_id: eventId });
      if (tallyRows) {
        const nextTally: Record<string, number> = {};
        for (const row of tallyRows) nextTally[row.option_id] = Number(row.votes);
        setTally(nextTally);
      }
      setResultsKey((k) => k + 1);
      const { data: statusRow } = await supabase
        .from("live_vote_events")
        .select("status, closes_at")
        .eq("id", eventId)
        .maybeSingle();
      if (statusRow) {
        setEvent((prev) => (prev ? { ...prev, status: statusRow.status, closes_at: statusRow.closes_at } : prev));
      }
    }, 10_000);

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Re-sync counts right after this browser votes, instead of waiting for
  // the realtime feed or the 10-second poll.
  async function refreshTally() {
    const { data: tallyRows } = await supabase.rpc("get_live_vote_tally", { p_event_id: eventId });
    if (tallyRows) {
      const nextTally: Record<string, number> = {};
      for (const row of tallyRows) nextTally[row.option_id] = Number(row.votes);
      setTally(nextTally);
    }
  }

  function toggleRank(optionId: string) {
    setDraftRanking((prev) =>
      prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
    );
  }

  function moveRank(index: number, delta: -1 | 1) {
    setDraftRanking((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function submitRanking() {
    if (!event || event.status !== "live" || myVote || submittingRanking || draftRanking.length === 0) return;
    setError(null);

    let token: string | null = null;
    if (event.voter_mode === "account") {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        window.location.href = `/login?next=${encodeURIComponent(`/vote/${eventId}`)}`;
        return;
      }
    } else {
      token = voterTokenRef.current ?? getOrCreateVoterToken();
      voterTokenRef.current = token;
    }

    setSubmittingRanking(true);
    const { error: rpcError } = await supabase.rpc("cast_ranked_live_vote", {
      p_event_id: eventId,
      p_ranking: draftRanking,
      p_voter_token: token,
    });
    setSubmittingRanking(false);
    if (rpcError) {
      if (rpcError.code === "23505") {
        setError(event.voter_mode === "account" ? "You've already voted in this event." : "This browser has already voted in this event.");
        load();
      } else {
        setError(rpcError.message);
      }
      return;
    }
    setMyRanking(draftRanking);
    setMyVote(draftRanking[0]);
    setResultsKey((k) => k + 1);
    // Re-sync the first-choice counts now rather than waiting for realtime/poll.
    const { data: tallyRows } = await supabase.rpc("get_live_vote_tally", { p_event_id: eventId });
    if (tallyRows) {
      const nextTally: Record<string, number> = {};
      for (const row of tallyRows) nextTally[row.option_id] = Number(row.votes);
      setTally(nextTally);
    }
  }

  async function handleVote(optionId: string) {
    if (!event || event.status !== "live" || myVote || voting) return;
    setError(null);

    if (event.voter_mode === "account") {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        window.location.href = `/login?next=${encodeURIComponent(`/vote/${eventId}`)}`;
        return;
      }
      setVoting(optionId);
      const { error: insertError } = await supabase
        .from("live_votes")
        .insert({ event_id: eventId, option_id: optionId, user_id: userData.user.id });
      setVoting(null);
      if (insertError) {
        if (insertError.code === "23505") {
          setError("You've already voted in this event.");
          load();
        } else {
          setError(insertError.message);
        }
        return;
      }
      setMyVote(optionId);
    refreshTally();
      return;
    }

    // open_link mode
    const token = voterTokenRef.current ?? getOrCreateVoterToken();
    voterTokenRef.current = token;
    setVoting(optionId);
    const { error: insertError } = await supabase
      .from("live_votes")
      .insert({ event_id: eventId, option_id: optionId, voter_token: token });
    setVoting(null);
    if (insertError) {
      if (insertError.code === "23505") {
        setError("This browser has already voted in this event.");
        load();
      } else {
        setError(insertError.message);
      }
      return;
    }
    setMyVote(optionId);
    refreshTally();
  }

  if (loading) {
    return <p style={{ color: "var(--text-faint)" }}>Loading…</p>;
  }

  if (notFound || !event) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Not found
        </h1>
        <p style={{ color: "var(--text-dim)" }}>
          This Live Vote Event doesn&apos;t exist or isn&apos;t open yet.
        </p>
      </div>
    );
  }

  const totalVotes = Object.values(tally).reduce((sum, n) => sum + n, 0);
  const maxVotes = Math.max(0, ...Object.values(tally));
  const judged = event.scoring_mode === "judges";
  const ranked = !judged && event.voting_method === "ranked";
  const optionNames: Record<string, string> = Object.fromEntries(options.map((o) => [o.id, o.name]));
  const canRank = ranked && event.status === "live" && !myVote;
  const canVoteSingle = !judged && !ranked && event.status === "live" && !myVote;

  return (
    <div>
      {(event.brand_name || event.brand_logo_url) && (
        <div className="mb-3 flex items-center gap-2.5">
          {event.brand_logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.brand_logo_url}
              alt={event.brand_name ? `${event.brand_name} logo` : "Brand logo"}
              className="h-9 w-9 rounded-lg border object-cover"
              style={{ borderColor: "var(--border)" }}
            />
          )}
          {event.brand_name && (
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
              Presented by {event.brand_name}
            </span>
          )}
        </div>
      )}
      {event.ads_enabled && <AdBanner placement="live_vote" />}
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-bold"
            style={{ background: "var(--surface-2)", color: event.status === "live" ? "var(--red)" : "var(--text-dim)" }}
          >
            {event.status === "live" ? "Live" : event.status === "closed" ? "Closed" : "Not open yet"}
          </span>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>
            {judged ? "Judged event" : `${totalVotes.toLocaleString()} vote${totalVotes === 1 ? "" : "s"}`}
          </span>
        </div>
        <ShareButton
          title={event.title}
          text={`${event.title}${event.brand_name ? ` — presented by ${event.brand_name}` : ""} — cast your vote, or start your own Bout, on BoutCasts!`}
        />
      </div>

      <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        {event.title}
      </h1>
      {event.description && (
        <p className="mb-4 text-sm" style={{ color: "var(--text-faint)" }}>
          {event.description}
        </p>
      )}
      <EventSponsorStrip eventId={eventId} />

      {event.status === "live" && event.closes_at && (
        <p className="mb-4 text-xs" style={{ color: "var(--text-faint)" }}>
          {judged ? "Judging" : "Voting"} closes {new Date(event.closes_at).toLocaleString()}
        </p>
      )}

      {!judged && event.status === "live" && event.voter_mode === "account" && !signedIn && (
        <p className="mb-4 rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
          <Link href={`/login?next=${encodeURIComponent(`/vote/${eventId}`)}`} className="font-semibold underline" style={{ color: "var(--red)" }}>
            Sign in
          </Link>{" "}
          to cast your vote. You can watch the live tally either way.
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--red)" }}>
          {error}
        </p>
      )}

      {myVote && !judged && event.collect_demographics && demoDone === false && (
        <DemographicsPrompt
          eventId={eventId}
          voterToken={event.voter_mode === "open_link" ? voterTokenRef.current : null}
          onDone={() => setDemoDone(true)}
        />
      )}

      {myVote && event.post_vote_graphic_url && (
        <div className="mb-4 overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.post_vote_graphic_url}
            alt={event.brand_name ? `${event.brand_name} graphic` : "Thanks for voting"}
            className="w-full object-cover"
          />
        </div>
      )}

      {judged && event.status !== "draft" && (
        <div className="mb-4">
          <JudgedResults eventId={eventId} status={event.status} refreshKey={resultsKey} />
        </div>
      )}

      {ranked && canRank && (
        <div className="mb-4 rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
          <p className="font-semibold" style={{ color: "var(--text)" }}>
            This is a ranked-choice vote.
          </p>
          <p className="mt-0.5">
            Tap <b>Rank</b> on the options in order of preference — your favorite first. Rank as many
            as you like, then submit your ballot. If your top pick is eliminated, your vote moves to
            your next choice.
          </p>
        </div>
      )}

      {ranked && myRanking && (
        <div className="mb-4 rounded-xl border p-3.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            ✓ Your ballot
          </p>
          <ol className="flex flex-col gap-1 text-sm">
            {myRanking.map((id, i) => (
              <li key={id}>
                <span className="mr-2 font-bold" style={{ color: "var(--red)" }}>
                  {i + 1}.
                </span>
                {optionNames[id] ?? "Unknown option"}
              </li>
            ))}
          </ol>
        </div>
      )}

      {ranked && (event.status !== "live" || myVote || totalVotes > 0) && (
        <div className="mb-4">
          <RankedResults eventId={eventId} optionNames={optionNames} status={event.status} refreshKey={resultsKey} />
        </div>
      )}

      <div className="flex flex-col gap-4">
        {options.map((option) => {
          const clip = displayClip(option);
          const votes = tally[option.id] ?? 0;
          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const isMine = ranked ? false : myVote === option.id;
          const isLeader = !ranked && event.status === "closed" && votes === maxVotes && maxVotes > 0;
          const draftIndex = draftRanking.indexOf(option.id);

          return (
            <div
              key={option.id}
              className="rounded-xl border p-3"
              style={{
                borderColor: isLeader ? "var(--red)" : "var(--border)",
                background: "var(--surface)",
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold">
                  {option.name}
                  {isLeader && (
                    <span className="ml-2 text-xs font-bold" style={{ color: "var(--red)" }}>
                      Leading
                    </span>
                  )}
                </p>
                {isMine && (
                  <span className="text-xs font-bold" style={{ color: "var(--red)" }}>
                    ✓ Your vote
                  </span>
                )}
              </div>

              {clip?.kind === "hosted" && <ClipPlayer src={clip.url} isAudio={clip.isAudio} label={option.name} />}
              {clip?.kind === "embed" && <EmbeddedClipPlayer sourceUrl={clip.url} label={option.name} />}
              {clip?.kind === "link" && (
                <a
                  href={clip.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold underline"
                  style={{ color: "var(--red)" }}
                >
                  Watch clip ↗
                </a>
              )}

              {(option.thumbnail_url || option.description) && (
                <div className="mt-3 flex gap-3">
                  {option.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={option.thumbnail_url}
                      alt={`${option.name} thumbnail`}
                      className="h-14 w-14 flex-shrink-0 rounded-lg border object-cover"
                      style={{ borderColor: "var(--border)" }}
                    />
                  )}
                  {option.description && (
                    <p className="text-sm" style={{ color: "var(--text-dim)" }}>
                      {option.description}
                    </p>
                  )}
                </div>
              )}

              {!judged && (
              <div className="mt-3">
                <div
                  className="h-2.5 w-full overflow-hidden rounded-full"
                  style={{ background: "var(--surface-2)" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: "var(--red)" }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-xs" style={{ color: "var(--text-faint)" }}>
                  <span>
                    {votes.toLocaleString()} {ranked ? "1st-choice " : ""}vote{votes === 1 ? "" : "s"} ({pct}%)
                  </span>
                  {canRank && (
                    <button
                      onClick={() => toggleRank(option.id)}
                      className="rounded-full border px-3 py-1 text-xs font-bold"
                      style={
                        draftIndex >= 0
                          ? { background: "var(--red)", borderColor: "var(--red)", color: "#fff" }
                          : { borderColor: "var(--red)", color: "var(--red)" }
                      }
                      aria-label={draftIndex >= 0 ? `Remove ${option.name} from your ranking` : `Rank ${option.name}`}
                    >
                      {draftIndex >= 0 ? `#${draftIndex + 1} ✕` : "Rank"}
                    </button>
                  )}
                  {canVoteSingle && (
                    <button
                      onClick={() => handleVote(option.id)}
                      disabled={voting === option.id}
                      className="rounded-full px-3 py-1 text-xs font-bold text-white disabled:opacity-60"
                      style={{ background: "var(--red)" }}
                    >
                      {voting === option.id ? "Voting…" : "Vote"}
                    </button>
                  )}
                </div>
              </div>
              )}
            </div>
          );
        })}
      </div>

      {canRank && draftRanking.length > 0 && (
        <div
          className="sticky bottom-3 mt-5 rounded-xl border p-3.5 shadow-lg"
          style={{ borderColor: "var(--red)", background: "var(--surface)" }}
        >
          <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            Your ranking
          </p>
          <ol className="mb-3 flex flex-col gap-1.5">
            {draftRanking.map((id, i) => (
              <li key={id} className="flex items-center gap-2 text-sm">
                <span className="w-5 font-bold" style={{ color: "var(--red)" }}>
                  {i + 1}.
                </span>
                <span className="flex-1 truncate">{optionNames[id]}</span>
                <button
                  type="button"
                  onClick={() => moveRank(i, -1)}
                  disabled={i === 0}
                  className="rounded border px-2 text-xs disabled:opacity-30"
                  style={{ borderColor: "var(--border)" }}
                  aria-label={`Move ${optionNames[id]} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveRank(i, 1)}
                  disabled={i === draftRanking.length - 1}
                  className="rounded border px-2 text-xs disabled:opacity-30"
                  style={{ borderColor: "var(--border)" }}
                  aria-label={`Move ${optionNames[id]} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => toggleRank(id)}
                  className="px-1 text-xs"
                  style={{ color: "var(--text-faint)" }}
                  aria-label={`Remove ${optionNames[id]}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={submitRanking}
            disabled={submittingRanking}
            className="w-full rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            style={{ background: "var(--red)" }}
          >
            {submittingRanking
              ? "Submitting…"
              : `Submit ballot (${draftRanking.length} of ${options.length} ranked)`}
          </button>
          <p className="mt-1.5 text-center text-[11px]" style={{ color: "var(--text-faint)" }}>
            You can&apos;t change your ballot after submitting.
          </p>
        </div>
      )}
    </div>
  );
}
