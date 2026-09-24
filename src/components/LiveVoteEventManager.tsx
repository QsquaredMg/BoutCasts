"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LIVE_VOTE_TIERS, type LiveVoteTier } from "@/lib/liveVoteEvents/tiers";

type EventStatus = "draft" | "live" | "closed";

type LiveVoteEventDetail = {
  id: string;
  organizer_id: string;
  title: string;
  description: string | null;
  voter_mode: "account" | "open_link";
  tier: LiveVoteTier;
  status: EventStatus;
  starts_at: string | null;
  closes_at: string | null;
};

type LiveVoteOptionRow = {
  id: string;
  name: string;
  source_type: string;
  sort_order: number;
};

type BreakdownRow = { label: string; count: number };

type LiveVoteAnalytics = {
  total_votes: number;
  account_votes: number;
  options: { option_id: string; name: string; votes: number }[];
  gender_breakdown: BreakdownRow[];
  ethnicity_breakdown: BreakdownRow[];
  age_breakdown: BreakdownRow[];
};

export default function LiveVoteEventManager({
  eventId,
  checkoutStatus,
}: {
  eventId: string;
  checkoutStatus: string | null;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notFoundOrForbidden, setNotFoundOrForbidden] = useState(false);
  const [event, setEvent] = useState<LiveVoteEventDetail | null>(null);
  const [options, setOptions] = useState<LiveVoteOptionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [closing, setClosing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [analytics, setAnalytics] = useState<LiveVoteAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: eventRow } = await supabase
      .from("live_vote_events")
      .select("id, organizer_id, title, description, voter_mode, tier, status, starts_at, closes_at")
      .eq("id", eventId)
      .maybeSingle();

    if (!eventRow || eventRow.organizer_id !== user.id) {
      setNotFoundOrForbidden(true);
      setLoading(false);
      return;
    }

    setEvent(eventRow);

    const { data: optionRows } = await supabase
      .from("live_vote_options")
      .select("id, name, source_type, sort_order")
      .eq("event_id", eventId)
      .order("sort_order");

    setOptions(optionRows ?? []);
    setLoading(false);

    if (eventRow.status === "closed") {
      setAnalyticsLoading(true);
      const { data: analyticsData, error: analyticsRpcError } = await supabase.rpc(
        "get_live_vote_analytics",
        { p_event_id: eventId }
      );
      setAnalyticsLoading(false);
      if (analyticsRpcError) {
        setAnalyticsError(analyticsRpcError.message);
      } else {
        setAnalytics(analyticsData as LiveVoteAnalytics);
      }
    }
  }, [supabase, eventId, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleGoLive() {
    setError(null);
    setCheckingOut(true);
    try {
      const res = await fetch("/api/checkout/live-vote-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong starting checkout.");
      }
      window.location.href = data.url;
    } catch (err) {
      setCheckingOut(false);
      setError(err instanceof Error ? err.message : "Something went wrong starting checkout.");
    }
  }

  async function handleDeleteDraft() {
    if (!confirm("Delete this draft event? This can't be undone.")) return;
    await supabase.from("live_vote_events").delete().eq("id", eventId);
    router.push("/live-vote");
  }

  async function handleCloseNow() {
    if (!confirm("Close voting now? Nobody will be able to vote after this.")) return;
    setClosing(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("close_live_vote_event", { p_event_id: eventId });
    setClosing(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    load();
  }

  function copyShareLink() {
    const url = `${window.location.origin}/vote/${eventId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return <p style={{ color: "var(--text-faint)" }}>Loading…</p>;
  }

  if (notFoundOrForbidden || !event) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Not found
        </h1>
        <p style={{ color: "var(--text-dim)" }}>
          This event doesn&apos;t exist, or you don&apos;t have access to manage it.
        </p>
      </div>
    );
  }

  const tierConfig = LIVE_VOTE_TIERS[event.tier];
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/vote/${event.id}` : "";

  return (
    <div>
      {checkoutStatus === "success" && event.status === "draft" && (
        <p
          className="mb-6 rounded-lg p-3 text-sm"
          style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}
        >
          Payment received — this event should go live within a moment. Refresh if it still
          shows as a draft.
        </p>
      )}
      {checkoutStatus === "cancelled" && (
        <p
          className="mb-6 rounded-lg p-3 text-sm"
          style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}
        >
          Checkout was cancelled — no charge was made.
        </p>
      )}

      <div className="mb-1 flex items-center gap-2">
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-bold"
          style={{
            background: "var(--surface-2)",
            color: event.status === "live" ? "var(--red)" : "var(--text-dim)",
          }}
        >
          {event.status === "draft" ? "Draft" : event.status === "live" ? "Live" : "Closed"}
        </span>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>
          {tierConfig.label} tier · {event.voter_mode === "account" ? "Account required" : "Open link"}
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

      <div className="mb-6 flex flex-col gap-1.5">
        {options.map((o, idx) => (
          <div
            key={o.id}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            {idx + 1}. {o.name}
          </div>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--red)" }}>
          {error}
        </p>
      )}

      {event.status === "draft" && (
        <div className="flex flex-col gap-2">
          <button
            onClick={handleGoLive}
            disabled={checkingOut}
            className="bc-btn-solid rounded-full px-5 py-3 text-sm font-bold disabled:opacity-60"
          >
            {checkingOut ? "Starting checkout…" : `Go live for $${(tierConfig.priceCents / 100).toFixed(0)}`}
          </button>
          <button
            onClick={handleDeleteDraft}
            className="rounded-full border px-5 py-2.5 text-sm font-semibold"
            style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}
          >
            Delete draft
          </button>
        </div>
      )}

      {event.status === "live" && (
        <div className="flex flex-col gap-3">
          <div
            className="rounded-lg border p-3"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <p className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
              Share this link with your voters
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate text-sm" style={{ color: "var(--text)" }}>
                {shareUrl}
              </code>
              <button
                onClick={copyShareLink}
                className="rounded-full border px-3 py-1 text-xs font-bold"
                style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
          {event.closes_at && (
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              Voting closes {new Date(event.closes_at).toLocaleString()}
            </p>
          )}
          <button
            onClick={handleCloseNow}
            disabled={closing}
            className="rounded-full border px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
          >
            {closing ? "Closing…" : "Close voting now"}
          </button>
        </div>
      )}

      {event.status === "closed" && (
        <div className="flex flex-col gap-4">
          <div
            className="rounded-lg border p-3"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              Voting has closed.{" "}
              <a href={shareUrl} className="font-semibold underline" style={{ color: "var(--red)" }}>
                View the final tally
              </a>
              .
            </p>
          </div>

          {analyticsLoading && <p style={{ color: "var(--text-faint)" }}>Loading analytics…</p>}
          {analyticsError && (
            <p className="rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--red)" }}>
              {analyticsError}
            </p>
          )}

          {analytics && (
            <div className="flex flex-col gap-4">
              <div className="bc-card p-4">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                  Results — {analytics.total_votes.toLocaleString()} total vote
                  {analytics.total_votes === 1 ? "" : "s"}
                </h2>
                <div className="flex flex-col gap-2">
                  {analytics.options.map((o) => {
                    const pct = analytics.total_votes > 0 ? Math.round((o.votes / analytics.total_votes) * 100) : 0;
                    return (
                      <div key={o.option_id}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-semibold">{o.name}</span>
                          <span style={{ color: "var(--text-faint)" }}>
                            {o.votes.toLocaleString()} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: "var(--red)" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {analytics.account_votes > 0 && (
                <div className="bc-card p-4">
                  <h2 className="mb-1 text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                    Voter demographics
                  </h2>
                  <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
                    Based on {analytics.account_votes.toLocaleString()} account vote
                    {analytics.account_votes === 1 ? "" : "s"} with a BoutCasts profile on file.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {(
                      [
                        ["Gender", analytics.gender_breakdown],
                        ["Ethnicity", analytics.ethnicity_breakdown],
                        ["Age", analytics.age_breakdown],
                      ] as const
                    ).map(([label, rows]) => (
                      <div key={label}>
                        <p className="mb-1.5 text-xs font-bold" style={{ color: "var(--text-dim)" }}>
                          {label}
                        </p>
                        <div className="flex flex-col gap-1">
                          {rows.length === 0 ? (
                            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                              No data
                            </p>
                          ) : (
                            rows.map((r) => (
                              <div key={r.label} className="flex items-center justify-between text-xs">
                                <span style={{ color: "var(--text-dim)" }}>{r.label}</span>
                                <span className="font-semibold" style={{ color: "var(--text-faint)" }}>
                                  {r.count.toLocaleString()}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
