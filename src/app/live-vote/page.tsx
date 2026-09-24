"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LIVE_VOTE_TIERS, type LiveVoteTier } from "@/lib/liveVoteEvents/tiers";

type LiveVoteEventRow = {
  id: string;
  title: string;
  status: "draft" | "live" | "closed";
  tier: LiveVoteTier;
  voter_mode: "account" | "open_link";
  created_at: string;
  closes_at: string | null;
};

const STATUS_LABEL: Record<LiveVoteEventRow["status"], string> = {
  draft: "Draft",
  live: "Live",
  closed: "Closed",
};

const STATUS_COLOR: Record<LiveVoteEventRow["status"], string> = {
  draft: "var(--text-dim)",
  live: "var(--red)",
  closed: "var(--text-faint)",
};

export default function LiveVoteEventsPage() {
  const supabase = createClient();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [events, setEvents] = useState<LiveVoteEventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      setSignedIn(!!user);

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("live_vote_events")
        .select("id, title, status, tier, voter_mode, created_at, closes_at")
        .eq("organizer_id", user.id)
        .order("created_at", { ascending: false });

      setEvents(data ?? []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  if (signedIn === false) {
    return (
      <div className="mx-auto max-w-lg px-5 py-12">
        <h1 className="mb-4 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Live Vote Events
        </h1>
        <p style={{ color: "var(--text-dim)" }}>
          You need to{" "}
          <a href="/login" className="font-semibold underline" style={{ color: "var(--red)" }}>
            sign in
          </a>{" "}
          to create or manage a Live Vote Event.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Live Vote Events
          </h1>
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>
            Run a real-time poll for your own event — any number of options, a public
            live tally, one vote per person. Pay per event, no subscription.
          </p>
        </div>
        <Link
          href="/live-vote/new"
          className="rounded-full px-4 py-2 text-sm font-bold text-white"
          style={{ background: "var(--red)" }}
        >
          + Create event
        </Link>
      </div>

      {(Object.keys(LIVE_VOTE_TIERS) as LiveVoteTier[]).length > 0 && (
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          {(Object.entries(LIVE_VOTE_TIERS) as [LiveVoteTier, (typeof LIVE_VOTE_TIERS)[LiveVoteTier]][]).map(
            ([key, tier]) => (
              <div
                key={key}
                className="rounded-xl border p-4"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                  {tier.label}
                </p>
                <p className="mt-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
                  ${(tier.priceCents / 100).toFixed(0)}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
                  Up to {tier.voteCap.toLocaleString()} votes ·{" "}
                  {tier.durationMs >= 24 * 60 * 60 * 1000
                    ? `${Math.round(tier.durationMs / (24 * 60 * 60 * 1000))}d`
                    : `${Math.round(tier.durationMs / (60 * 60 * 1000))}hr`}{" "}
                  window
                </p>
              </div>
            )
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          Loading…
        </p>
      ) : events.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          You haven&apos;t created a Live Vote Event yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/live-vote/${event.id}`}
              className="flex items-center justify-between rounded-xl border px-4 py-3 hover:opacity-90"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <div>
                <p className="font-semibold">{event.title}</p>
                <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {LIVE_VOTE_TIERS[event.tier]?.label ?? event.tier} ·{" "}
                  {event.voter_mode === "account" ? "Account required" : "Open link"}
                </p>
              </div>
              <span
                className="rounded-full px-3 py-1 text-xs font-bold"
                style={{ color: STATUS_COLOR[event.status], background: "var(--surface-2)" }}
              >
                {STATUS_LABEL[event.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
