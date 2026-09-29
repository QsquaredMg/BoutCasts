"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SIDE_LABEL, timeLeft, type DebateSide } from "@/lib/debates";

type Scores = { argument: number; evidence: number; rebuttal: number; delivery: number };
type JudgeMatch = {
  id: string;
  status: "voting" | "final";
  bracket_round: number | null;
  voting_closes_at: string | null;
  for_name: string;
  against_name: string;
  my_scores: Partial<Record<DebateSide, Scores>> | null;
};
type Panel = { judge_name: string; topic: { id: string; statement: string; description: string | null }; matches: JudgeMatch[] };

const CRITERIA: (keyof Scores)[] = ["argument", "evidence", "rebuttal", "delivery"];
const blank: Scores = { argument: 5, evidence: 5, rebuttal: 5, delivery: 5 };

export default function DebateJudgePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const supabase = createClient();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Record<DebateSide, Scores>>>({});
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc("judge_get_debate", { p_token: token });
    if (e) return setError(e.message);
    const p = data as Panel;
    setPanel(p);
    setDraft(
      Object.fromEntries(
        p.matches.map((m) => [m.id, { for: m.my_scores?.for ?? { ...blank }, against: m.my_scores?.against ?? { ...blank } }])
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function save(matchId: string) {
    setError(null);
    for (const side of ["for", "against"] as DebateSide[]) {
      const s = draft[matchId][side];
      const { error: e } = await supabase.rpc("judge_score_debate", {
        p_token: token,
        p_match_id: matchId,
        p_side: side,
        p_argument: s.argument,
        p_evidence: s.evidence,
        p_rebuttal: s.rebuttal,
        p_delivery: s.delivery,
      });
      if (e) return setError(e.message);
    }
    setSaved(matchId);
    load();
  }

  if (error && !panel) return <p className="mx-auto max-w-2xl px-5 py-10" style={{ color: "var(--danger)" }}>{error}</p>;
  if (!panel) return <p className="mx-auto max-w-2xl px-5 py-10" style={{ color: "var(--text-faint)" }}>Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--red)" }}>
        Judge panel · {panel.judge_name}
      </p>
      <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        &ldquo;{panel.topic.statement}&rdquo;
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-dim)" }}>
        Watch each debate in full, then score both sides from 1–10 on argument, evidence, rebuttal and delivery. You can
        change your scores until voting closes. Keep this link private.
      </p>
      {panel.matches.length === 0 && (
        <p className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}>
          No debates are ready to judge yet. Debates appear here once both sides have finished.
        </p>
      )}
      <div className="flex flex-col gap-4">
        {panel.matches.map((m) => (
          <div key={m.id} className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <p className="font-bold">
                {m.for_name} <span style={{ color: "var(--text-faint)" }}>vs</span> {m.against_name}
              </p>
              <Link href={`/debates/match/${m.id}`} target="_blank" className="shrink-0 text-xs font-bold" style={{ color: "var(--red)" }}>
                Watch ↗
              </Link>
            </div>
            {m.status === "final" ? (
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>
                Judging closed.
              </p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(["for", "against"] as DebateSide[]).map((side) => (
                    <div key={side}>
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                        {SIDE_LABEL[side]} · {side === "for" ? m.for_name : m.against_name}
                      </p>
                      {CRITERIA.map((c) => (
                        <label key={c} className="mb-1.5 flex items-center justify-between gap-3 text-sm capitalize">
                          {c}
                          <select
                            value={draft[m.id]?.[side]?.[c] ?? 5}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, [m.id]: { ...d[m.id], [side]: { ...d[m.id][side], [c]: Number(e.target.value) } } }))
                            }
                            className="rounded-lg border px-2 py-1 text-sm"
                            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                          >
                            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                    Closes {timeLeft(m.voting_closes_at)}
                  </span>
                  <button type="button" onClick={() => save(m.id)} className="bc-btn-solid rounded-full px-4 py-2 text-sm font-bold">
                    {m.my_scores ? "Update scores" : "Submit scores"}
                  </button>
                </div>
                {saved === m.id && (
                  <p className="mt-2 text-xs font-semibold" style={{ color: "var(--red)" }}>
                    ✓ Saved
                  </p>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      {error && (
        <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
