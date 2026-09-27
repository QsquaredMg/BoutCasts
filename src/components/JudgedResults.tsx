"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Judges-panel scoreboard. The organizer always sees it; everyone else sees
// it once the organizer releases results (enforced in get_judged_results).

type ResultRow = {
  option_id: string;
  name: string;
  average: number | null;
  judges_scored: number;
  by_criterion: { criterion_id: string | null; average: number }[];
};
type Judged = {
  released: boolean;
  judges_total?: number;
  judges_submitted?: number;
  criteria?: { id: string; name: string }[];
  results?: ResultRow[];
};

export default function JudgedResults({
  eventId,
  status,
  refreshKey = 0,
}: {
  eventId: string;
  status: "draft" | "live" | "closed";
  refreshKey?: number;
}) {
  const supabase = createClient();
  const [data, setData] = useState<Judged | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: res, error: rpcError } = await supabase.rpc("get_judged_results", { p_event_id: eventId });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setError(null);
    setData(res as Judged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load, refreshKey]);

  const box = { borderColor: "var(--border)", background: "var(--surface)" };

  if (error) {
    return (
      <p className="text-xs" style={{ color: "var(--text-faint)" }}>
        Couldn&apos;t load the judges&apos; scores: {error}
      </p>
    );
  }
  if (!data) return null;

  // Public view before release.
  if (!data.results) {
    return (
      <div className="rounded-xl border p-3.5" style={box}>
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
          Judged event
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-faint)" }}>
          {status === "closed"
            ? "Judging is complete. Results will be posted here when the organizer releases them."
            : "A panel of judges is scoring each contestant. Results will be posted here when the organizer releases them."}
        </p>
      </div>
    );
  }

  const criteria = data.criteria ?? [];
  const results = data.results;
  const scored = results.filter((r) => r.average !== null);
  const top = scored.length > 0 ? scored[0].average : null;
  const leaders = scored.filter((r) => r.average === top);
  const final = status === "closed";

  return (
    <div className="rounded-xl border p-3.5" style={box}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
          Judges&apos; scoreboard
        </p>
        {data.judges_total !== undefined && (
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>
            {data.judges_submitted}/{data.judges_total} judges submitted
          </span>
        )}
      </div>

      {leaders.length > 0 && (
        <p className="mt-1 text-lg font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--red)" }}>
          {leaders.length > 1 ? (final ? "Tie: " : "Tied: ") : final ? "Winner: " : "Leading: "}
          {leaders.map((l) => l.name).join(" & ")}
        </p>
      )}

      <ol className="mt-3 flex flex-col gap-2.5">
        {results.map((r, i) => (
          <li key={r.option_id}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold">
                <span className="mr-1.5" style={{ color: "var(--text-faint)" }}>
                  {i + 1}.
                </span>
                {r.name}
              </span>
              <span className="font-bold">{r.average !== null ? r.average.toFixed(2) : "—"}</span>
            </div>
            <div className="mt-0.5 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${((r.average ?? 0) / 10) * 100}%`, background: "var(--red)" }}
              />
            </div>
            {criteria.length > 0 && r.by_criterion.length > 0 && (
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
                {criteria
                  .map((c) => {
                    const hit = r.by_criterion.find((b) => b.criterion_id === c.id);
                    return hit ? `${c.name} ${Number(hit.average).toFixed(1)}` : null;
                  })
                  .filter(Boolean)
                  .join(" · ")}
                {data.judges_total !== undefined && ` · ${r.judges_scored} judge${r.judges_scored === 1 ? "" : "s"}`}
              </p>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-2.5 text-[11px] leading-snug" style={{ color: "var(--text-faint)" }}>
        Scores are out of 10: each judge&apos;s scores for a contestant are averaged, then averaged
        across judges.
      </p>
    </div>
  );
}
