"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ClipPlayer from "@/components/ClipPlayer";
import EmbeddedClipPlayer from "@/components/EmbeddedClipPlayer";
import { getClipSourceTag, getEmbedInfo } from "@/lib/clipSource";

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
  post_vote_graphic_url: string | null;
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

function displayClip(option: OptionRow) {
  if (!option.source_url) return null;
  if (option.source_type === "upload" || option.source_type === "record") {
    return {
      kind: "hosted" as const,
      url: option.source_url,
      isAudio: getClipSourceTag(option.source_type, option.source_url).isAudio,
    };
  }
  if (option.source_type === "link" && getEmbedInfo(option.source_url)) {
    return { kind: "embed" as const, url: option.source_url };
  }
  return { kind: "link" as const, url: option.source_url };
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

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    setSignedIn(!!user);

    const { data: eventRow } = await supabase
      .from("live_vote_events")
      .select("id, title, description, voter_mode, status, closes_at, brand_name, brand_logo_url, post_vote_graphic_url")
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

    if (eventRow.voter_mode === "account" && user) {
      const { data: existingVote } = await supabase
        .from("live_votes")
        .select("option_id")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle();
      setMyVote(existingVote?.option_id ?? null);
    } else if (eventRow.voter_mode === "open_link") {
      const token = getOrCreateVoterToken();
      voterTokenRef.current = token;
      const { data: existingVote } = await supabase
        .from("live_votes")
        .select("option_id")
        .eq("event_id", eventId)
        .eq("voter_token", token)
        .maybeSingle();
      setMyVote(existingVote?.option_id ?? null);
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
        { event: "INSERT", schema: "public", table: "live_votes", filter: `event_id=eq.${eventId}` },
        (payload) => {
          const optionId = (payload.new as { option_id: string }).option_id;
          setTally((prev) => ({ ...prev, [optionId]: (prev[optionId] ?? 0) + 1 }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function handleVote(optionId: string) {
    if (!event || event.status !== "live" || myVote || voting) return;
    setError(null);

    if (event.voter_mode === "account") {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        window.location.href = "/login";
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
      <div className="mb-1 flex items-center gap-2">
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-bold"
          style={{ background: "var(--surface-2)", color: event.status === "live" ? "var(--red)" : "var(--text-dim)" }}
        >
          {event.status === "live" ? "Live" : event.status === "closed" ? "Closed" : "Not open yet"}
        </span>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>
          {totalVotes.toLocaleString()} vote{totalVotes === 1 ? "" : "s"}
        </span>
      </div>

      <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        {event.title}
      </h1>
      {event.description && (
        <p className="mb-4 text-sm" style={{ color: "var(--text-faint)" }}>
          {event.description}
        </p>
      )}
      {event.status === "live" && event.closes_at && (
        <p className="mb-4 text-xs" style={{ color: "var(--text-faint)" }}>
          Voting closes {new Date(event.closes_at).toLocaleString()}
        </p>
      )}

      {event.status === "live" && event.voter_mode === "account" && !signedIn && (
        <p className="mb-4 rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
          <Link href="/login" className="font-semibold underline" style={{ color: "var(--red)" }}>
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

      <div className="flex flex-col gap-4">
        {options.map((option) => {
          const clip = displayClip(option);
          const votes = tally[option.id] ?? 0;
          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const isMine = myVote === option.id;
          const isLeader = event.status === "closed" && votes === maxVotes && maxVotes > 0;

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
                    {votes.toLocaleString()} vote{votes === 1 ? "" : "s"} ({pct}%)
                  </span>
                  {event.status === "live" && !myVote && (
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
