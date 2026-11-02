"use client";

import { useEffect, useState } from "react";

type Result =
  | { id: string; type: "rating"; text: string; n: number; avg: number | null; byGrade: { grade: string; n: number; avg: number | null }[] }
  | { id: string; type: "top3"; text: string; n: number; ranked: { option: string; count: number }[] }
  | { id: string; type: "open"; text: string; n: number; answers: string[] };

// Survey results for the people who build campaigns from them. Candidates see them when the teacher closes the survey.
export default function SurveyResults({ id, code }: { id: string; code?: string }) {
  const [state, setState] = useState<{ ready: boolean; reason?: string; total?: number; results?: Result[] } | null>(null);
  useEffect(() => {
    Promise.resolve().then(async () => {
      const res = await fetch(`/api/school-election/${id}/survey/results`, { cache: "no-store", headers: code ? { "x-desk-code": code } : {} });
      setState(res.ok ? await res.json() : { ready: false, reason: "error" });
    }).catch(() => setState({ ready: false, reason: "error" }));
  }, [id, code]);

  const card = "rounded-xl border bg-white p-4 shadow-sm";
  const edge = { borderColor: "var(--border)" } as const;
  if (!state) return null;
  if (!state.ready) {
    return (
      <div className={card} style={edge}>
        <h2 className="font-black">Voter survey results</h2>
        <p className="mt-1 text-sm">{state.reason === "not_closed" ? "Results appear for everyone at the same time, when your teacher closes the survey. Until then, get out and talk to voters in other classes." : state.reason === "no_survey" ? "Your teacher hasn't set up a survey yet." : "Couldn't load the results."}</p>
      </div>
    );
  }
  return (
    <div className={card} style={edge}>
      <h2 className="font-black">Voter survey results</h2>
      <p className="text-xs" style={{ color: "var(--text-faint)" }}>{state.total} responses. Breakdowns by grade show only when a grade has at least 5 responses.</p>
      <div className="mt-3 grid gap-4">
        {(state.results ?? []).map((r) => (
          <section key={r.id}>
            <p className="text-sm font-bold">{r.text}</p>
            {r.type === "rating" && (
              <>
                <p className="mt-1 text-sm">Average {r.avg ?? "n/a"} out of 5 ({r.n} answers)</p>
                {r.byGrade.length > 0 && <p className="text-xs" style={{ color: "var(--text-faint)" }}>{r.byGrade.map((g) => `${g.grade}: ${g.avg}`).join(" · ")}</p>}
              </>
            )}
            {r.type === "top3" && (
              <ol className="mt-1 grid gap-1 text-sm">
                {r.ranked.slice(0, 6).map((x) => (
                  <li key={x.option} className="flex items-center gap-2">
                    <span className="w-44 shrink-0">{x.option}</span>
                    <span className="h-3 rounded bg-[#1b4fe4]" style={{ width: `${Math.max(4, Math.round((x.count / Math.max(1, r.ranked[0]?.count ?? 1)) * 100))}%` }} aria-hidden />
                    <span className="text-xs">{x.count}</span>
                  </li>
                ))}
              </ol>
            )}
            {r.type === "open" && (
              <ul className="mt-1 grid gap-1 text-sm">
                {r.answers.slice(0, 30).map((a, i) => <li key={i} className="rounded bg-[#f4f6fb] px-2 py-1">{a}</li>)}
                {r.answers.length === 0 && <li className="text-xs">No answers.</li>}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
