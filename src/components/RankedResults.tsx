"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Round-by-round instant-runoff results for a ranked-choice Live Vote.
// The counting itself happens in the database (get_live_vote_irv) so every
// screen — ballot, organizer dashboard, big screen — shows the same result.

type Tally = { option_id: string; votes: number };
type Round = {
  round: number;
  tallies: Tally[];
  continuing_ballots: number;
  exhausted_ballots: number;
  eliminated_option_id: string | null;
};
type IrvResult = {
  total_ballots: number;
  rounds: Round[];
  winner_option_id: string | null;
  tied_option_ids: string[];
};

export default function RankedResults({
  eventId,
  optionNames,
  status,
  refreshKey = 0,
}: {
  eventId: string;
  optionNames: Record<string, string>;
  status: "draft" | "live" | "closed";
  refreshKey?: number;
}) {
  const supabase = createClient();
  const [result, setResult] = useState<IrvResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc("get_live_vote_irv", { p_event_id: eventId });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setError(null);
    setResult(data as IrvResult);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load, refreshKey]);

  if (error) {
    return (
      <p className="text-xs" style={{ color: "var(--text-faint)" }}>
        Couldn&apos;t load the runoff results: {error}
      </p>
    );
  }
  if (!result) return null;

  const name = (id: string | null) => (id ? optionNames[id] ?? "Unknown option" : "");
  const live = status === "live";

  if (result.total_ballots === 0) {
    return (
      <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
          Ranked-choice results
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-faint)" }}>
          No ballots yet.
        </p>
      </div>
    );
  }

  const finalRound = result.rounds[result.rounds.length - 1];
  const roundsToShow = showAll ? result.rounds : [finalRound];

  let headline: string;
  if (result.winner_option_id) {
    headline = `${live ? "Leading" : "Winner"}: ${name(result.winner_option_id)}`;
  } else if (result.tied_option_ids.length > 0) {
    headline = `${live ? "Currently tied" : "Tie"}: ${result.tied_option_ids.map(name).join(" & ")}`;
  } else {
    headline = "No majority yet";
  }

  return (
    <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
          Ranked-choice results{live ? " (live)" : ""}
        </p>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>
          {result.total_ballots.toLocaleString()} ballot{result.total_ballots === 1 ? "" : "s"} ·{" "}
          {result.rounds.length} round{result.rounds.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-1 text-lg font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--red)" }}>
        {headline}
      </p>

      <div className="mt-3 flex flex-col gap-3">
        {roundsToShow.map((round) => {
          const max = Math.max(1, ...round.tallies.map((t) => t.votes));
          return (
            <div key={round.round}>
              <p className="mb-1.5 text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                Round {round.round}
                {round.exhausted_ballots > 0 &&
                  ` · ${round.exhausted_ballots.toLocaleString()} ballot${round.exhausted_ballots === 1 ? "" : "s"} with no remaining choices`}
              </p>
              <div className="flex flex-col gap-1.5">
                {round.tallies.map((t) => {
                  const pct = round.continuing_ballots > 0 ? Math.round((t.votes / round.continuing_ballots) * 100) : 0;
                  const out = round.eliminated_option_id === t.option_id;
                  const won = result.winner_option_id === t.option_id && round === finalRound;
                  return (
                    <div key={t.option_id}>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: out ? "var(--text-faint)" : undefined, fontWeight: won ? 700 : 500 }}>
                          {name(t.option_id)}
                          {out && " — eliminated"}
                          {won && " ✓"}
                        </span>
                        <span style={{ color: "var(--text-faint)" }}>
                          {t.votes.toLocaleString()} ({pct}%)
                        </span>
                      </div>
                      <div className="mt-0.5 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(t.votes / max) * 100}%`,
                            background: out ? "var(--text-faint)" : "var(--red)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {result.rounds.length > 1 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-xs font-semibold underline"
          style={{ color: "var(--text-dim)" }}
        >
          {showAll ? "Show final round only" : `Show all ${result.rounds.length} rounds`}
        </button>
      )}
      <p className="mt-2 text-[11px] leading-snug" style={{ color: "var(--text-faint)" }}>
        Each round counts every ballot for its highest-ranked option still in the race. If no option
        has a majority, the last-place option is eliminated and its ballots move to their next choice.
      </p>
    </div>
  );
}
