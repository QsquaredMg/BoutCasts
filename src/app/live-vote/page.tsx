"use client";

import { useEffect, useState } from "react";
import SignInCard from "@/components/SignInCard";
import Link from "next/link";
import OrganizerProCard from "@/components/OrganizerProCard";
import { createClient } from "@/lib/supabase/client";
import { LIVE_VOTE_TIERS, tierPriceLabel, type LiveVoteTier } from "@/lib/liveVoteEvents/tiers";

type LiveVoteEventRow = {
  id: string;
  title: string;
  status: "draft" | "live" | "closed";
  tier: LiveVoteTier;
  voter_mode: "account" | "open_link";
  created_at: string;
  closes_at: string | null;
  is_private: boolean;
  access_code: string | null;
};

const STATUS_LABEL: Record<LiveVoteEventRow["status"], string> = {
  draft: "Draft",
  live: "Live",
  closed: "Closed",
};

const STATUS_COLOR: Record<LiveVoteEventRow["status"], string> = {
  draft: "var(--text-dim)",
  live: "var(--live)",
  closed: "var(--text-faint)",
};

export default function LiveVoteEventsPage() {
  const supabase = createClient();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [events, setEvents] = useState<LiveVoteEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"private" | "public">("private");

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
        .select("id, title, status, tier, voter_mode, created_at, closes_at, is_private, access_code")
        .eq("organizer_id", user.id)
        .order("created_at", { ascending: false });

      setEvents(data ?? []);
      if (data && data.length > 0 && !data.some((e) => e.is_private)) setTab("public");
      setLoading(false);
    }
    load();
  }, [supabase]);

  if (signedIn === false) {
    return (
      <SignInCard
        eyebrow="Live Vote"
        title="Let the crowd decide"
        body="Sign in to create and manage Live Votes — class elections, event polls, halftime votes and talent shows with a live tally. Start free."
        next="/live-vote"
      />
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
            live tally, one vote per person. Pay per event, or go monthly with Organizer Pro.
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

      {signedIn && (
        <section className="mb-8">
          <div className="mb-3 flex gap-1 rounded-full border p-1" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            {(
              [
                ["private", "🔒 Private events", events.filter((e) => e.is_private).length],
                ["public", "🌎 Public events", events.filter((e) => !e.is_private).length],
              ] as const
            ).map(([key, label, n]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className="flex-1 rounded-full px-3 py-2 text-sm font-semibold"
                style={{
                  background: tab === key ? "var(--surface-2)" : "transparent",
                  color: tab === key ? "var(--text)" : "var(--text-dim)",
                  boxShadow: tab === key ? "inset 0 0 0 1px var(--border)" : "none",
                }}
              >
                {label} ({n})
              </button>
            ))}
          </div>
          <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
            {tab === "private"
              ? "School, team and private-group events. Never shown publicly — voters get in with your link, QR code or event code."
              : "Events anyone can find on the Explore page (when listed) or open with your link."}
          </p>
          {loading ? (
            <p className="text-sm" style={{ color: "var(--text-faint)" }}>
              Loading…
            </p>
          ) : events.filter((e) => e.is_private === (tab === "private")).length === 0 ? (
            <div className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}>
              No {tab} events yet.{" "}
              <Link href="/live-vote/new" className="font-semibold underline" style={{ color: "var(--red)" }}>
                Create one
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {events
                .filter((e) => e.is_private === (tab === "private"))
                .map((event) => (
                  <Link
                    key={event.id}
                    href={`/live-vote/${event.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 hover:opacity-90"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{event.title}</p>
                      <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                        {LIVE_VOTE_TIERS[event.tier]?.label ?? event.tier} ·{" "}
                        {event.voter_mode === "account" ? "Account required" : "Open link"}
                        {event.is_private && event.access_code ? (
                          <>
                            {" "}· Code{" "}
                            <strong className="tracking-[0.15em]" style={{ color: "var(--text)" }}>
                              {event.access_code}
                            </strong>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <span
                      className="flex-shrink-0 rounded-full px-3 py-1 text-xs font-bold"
                      style={{ color: STATUS_COLOR[event.status], background: "var(--surface-2)" }}
                    >
                      {STATUS_LABEL[event.status]}
                    </span>
                  </Link>
                ))}
            </div>
          )}
        </section>
      )}

      {(Object.keys(LIVE_VOTE_TIERS) as LiveVoteTier[]).length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                  {tierPriceLabel(key)}
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

      {signedIn && <OrganizerProCard />}

      <Link
        href="/competitions"
        className="mb-8 flex items-center justify-between gap-3 rounded-xl border p-4 hover:opacity-90"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <span>
          <span className="block font-semibold">Running a bracket competition instead?</span>
          <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
            Collect entries by link, approve them, and build a head-to-head bracket the crowd votes on.
          </span>
        </span>
        <span className="text-sm font-bold" style={{ color: "var(--red)" }}>
          Competitions →
        </span>
      </Link>

      <Link
        href="/org"
        className="mb-8 flex items-center justify-between gap-3 rounded-xl border p-4 hover:opacity-90"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <span>
          <span className="block font-semibold">For schools, districts &amp; leagues</span>
          <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
            One annual license: staff accounts, unlimited Live Votes, Pro analytics and white-label.
          </span>
        </span>
        <span className="text-sm font-bold" style={{ color: "var(--red)" }}>
          License →
        </span>
      </Link>

    </div>
  );
}
