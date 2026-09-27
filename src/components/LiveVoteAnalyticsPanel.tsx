"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PRO_ADDON_CENTS } from "@/lib/liveVoteEvents/tiers";

// Organizer analytics for a crowd-vote Live Vote. Free: totals per option.
// Pro: turnout over time, optional voter demographics (totals only, groups
// under 5 hidden by the database), and CSV export.

type Group = { label: string; count: number | null };
type Analytics = {
  pro: boolean;
  status: "live" | "closed";
  total_votes: number;
  account_votes?: number;
  options: { name: string; votes: number }[];
  bucket_minutes?: number;
  turnout?: { t: string; votes: number }[];
  collect_demographics?: boolean;
  demographics_answered?: number;
  age?: Group[];
  gender?: Group[];
  race_ethnicity?: Group[];
};

export const DEMOGRAPHIC_LABELS: Record<string, string> = {
  "13-17": "13–17",
  "18-24": "18–24",
  "25-34": "25–34",
  "35-44": "35–44",
  "45-54": "45–54",
  "55-64": "55–64",
  "65+": "65+",
  woman: "Woman",
  man: "Man",
  nonbinary: "Non-binary",
  self_describe: "Self-described",
  american_indian_alaska_native: "American Indian or Alaska Native",
  asian: "Asian",
  black: "Black or African American",
  hispanic_latino: "Hispanic or Latino",
  middle_eastern_north_african: "Middle Eastern or North African",
  native_hawaiian_pacific_islander: "Native Hawaiian or Pacific Islander",
  white: "White",
  multiracial: "Multiracial",
  other: "Other",
  prefer_not: "Prefer not to say",
  no_answer: "Skipped",
};

function csvEscape(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function LiveVoteAnalyticsPanel({
  eventId,
  eventTitle,
  refreshKey = 0,
}: {
  eventId: string;
  eventTitle: string;
  refreshKey?: number;
}) {
  const supabase = createClient();
  const [a, setA] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  const load = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc("get_live_vote_analytics", { p_event_id: eventId });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setError(null);
    setA(data as Analytics);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load, refreshKey]);

  async function upgrade() {
    setUpgrading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/live-vote-pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't start checkout.");
      window.location.assign(data.url);
    } catch (err) {
      setUpgrading(false);
      setError(err instanceof Error ? err.message : "Couldn't start checkout.");
    }
  }

  function exportCsv() {
    if (!a) return;
    const rows: (string | number)[][] = [["BoutCasts Live Vote analytics"], ["Event", eventTitle], ["Exported", new Date().toISOString()], []];
    rows.push(["Option", "Votes", "Share"]);
    for (const o of a.options) rows.push([o.name, o.votes, a.total_votes ? `${((o.votes / a.total_votes) * 100).toFixed(1)}%` : "0%"]);
    rows.push(["Total", a.total_votes], []);
    if (a.turnout?.length) {
      rows.push([`Turnout (${a.bucket_minutes}-minute intervals, UTC)`, "Votes"]);
      for (const t of a.turnout) rows.push([t.t, t.votes]);
      rows.push([]);
    }
    const groups: [string, Group[] | undefined][] = [
      ["Age", a.age],
      ["Gender", a.gender],
      ["Race / ethnicity", a.race_ethnicity],
    ];
    if ((a.demographics_answered ?? 0) > 0) {
      rows.push(["Question", "Answer", "Voters"]);
      for (const [q, g] of groups) for (const r of g ?? []) rows.push([q, DEMOGRAPHIC_LABELS[r.label] ?? r.label, r.count ?? "Fewer than 5"]);
      rows.push([], ["Groups under 5 people are hidden to protect voter privacy."]);
    }
    const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${eventTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "live-vote"}-analytics.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const card = "rounded-xl border p-4";
  const cardStyle = { borderColor: "var(--border)", background: "var(--surface)" };
  const h = "mb-2 text-xs font-bold uppercase tracking-wide";

  if (error && !a) {
    return (
      <p className="rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--red)" }}>
        {error}
      </p>
    );
  }
  if (!a) return <p style={{ color: "var(--text-faint)" }}>Loading analytics…</p>;

  const maxTurnout = Math.max(1, ...(a.turnout ?? []).map((t) => t.votes));

  return (
    <div className="flex flex-col gap-4">
      <div className={card} style={cardStyle}>
        <div className="flex items-baseline justify-between gap-2">
          <p className={h} style={{ color: "var(--text-dim)" }}>
            {a.status === "live" ? "Live results" : "Final results"} — {a.total_votes.toLocaleString()} vote
            {a.total_votes === 1 ? "" : "s"}
          </p>
          {a.pro && (
            <button type="button" onClick={exportCsv} className="text-xs font-bold" style={{ color: "var(--red)" }}>
              Export CSV
            </button>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {a.options.map((o) => {
            const pct = a.total_votes > 0 ? Math.round((o.votes / a.total_votes) * 100) : 0;
            return (
              <div key={o.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-semibold">{o.name}</span>
                  <span style={{ color: "var(--text-faint)" }}>
                    {o.votes.toLocaleString()} ({pct}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--red)" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!a.pro && (
        <div className={card} style={{ ...cardStyle, borderColor: "var(--red)" }}>
          <p className="font-semibold">Unlock Pro analytics</p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
            See turnout over time, optional voter demographics (age, gender, race/ethnicity — totals
            only), and export everything to CSV for your report.
          </p>
          <button
            type="button"
            onClick={upgrade}
            disabled={upgrading}
            className="bc-btn-solid mt-3 w-full rounded-full px-4 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            {upgrading ? "Starting checkout…" : `Unlock Pro for $${PRO_ADDON_CENTS / 100}`}
          </button>
          <p className="mt-2 text-center text-xs" style={{ color: "var(--text-faint)" }}>
            Or get Pro on every event with{" "}
            <Link href="/live-vote#organizer-pro" className="font-semibold underline">
              Organizer Pro
            </Link>
            .
          </p>
          {error && (
            <p className="mt-2 text-xs" style={{ color: "var(--red)" }}>
              {error}
            </p>
          )}
        </div>
      )}

      {a.pro && (a.turnout?.length ?? 0) > 0 && (
        <div className={card} style={cardStyle}>
          <p className={h} style={{ color: "var(--text-dim)" }}>
            Turnout over time
          </p>
          <div className="flex h-28 items-end gap-[2px]" role="img" aria-label="Votes per time interval">
            {a.turnout!.map((t) => (
              <div
                key={t.t}
                className="flex-1 rounded-t"
                title={`${new Date(t.t).toLocaleString()}: ${t.votes} vote${t.votes === 1 ? "" : "s"}`}
                style={{ height: `${Math.max(4, (t.votes / maxTurnout) * 100)}%`, background: "var(--red)", minWidth: 3 }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px]" style={{ color: "var(--text-faint)" }}>
            <span>{new Date(a.turnout![0].t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            <span>Each bar = {a.bucket_minutes} min · peak {maxTurnout}</span>
          </div>
        </div>
      )}

      {a.pro && (
        <div className={card} style={cardStyle}>
          <p className={h} style={{ color: "var(--text-dim)" }}>
            Voter demographics
          </p>
          {!a.collect_demographics && (a.demographics_answered ?? 0) === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-faint)" }}>
              Turn on &ldquo;Ask voters optional demographic questions&rdquo; above to collect these.
            </p>
          ) : (a.demographics_answered ?? 0) === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-faint)" }}>
              No answers yet. Voters see the optional questions right after they vote.
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
                {a.demographics_answered!.toLocaleString()} of {a.total_votes.toLocaleString()} voters answered.
                Groups under 5 people are hidden to protect privacy.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {(
                  [
                    ["Age", a.age],
                    ["Gender", a.gender],
                    ["Race / ethnicity", a.race_ethnicity],
                  ] as const
                ).map(([label, rows]) => (
                  <div key={label}>
                    <p className="mb-1.5 text-xs font-bold" style={{ color: "var(--text-dim)" }}>
                      {label}
                    </p>
                    <div className="flex flex-col gap-1">
                      {(rows ?? []).map((r) => (
                        <div key={r.label} className="flex items-center justify-between gap-2 text-xs">
                          <span style={{ color: "var(--text-dim)" }}>{DEMOGRAPHIC_LABELS[r.label] ?? r.label}</span>
                          <span className="font-semibold" style={{ color: "var(--text-faint)" }}>
                            {r.count === null ? "<5" : r.count.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
