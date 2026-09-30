"use client";

import { use, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SharedVideoPlayer from "@/components/showcases/SharedVideoPlayer";
import { CRITERIA, formatClock, type ShowcaseKind } from "@/lib/showcases";

type Score = { c1: number; c2: number; c3: number; c4: number };
type Choice = { id: string; name: string; team_name: string | null; image_url: string | null; start_seconds: number | null; my_score: Score | null };
type Panel = {
  judge_name: string;
  showcase: { id: string; kind: ShowcaseKind; title: string; status: string; closes_at: string | null; source_type: string; source_url: string };
  choices: Choice[];
};


export default function ShowcaseJudgePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const supabase = createClient();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [draft, setDraft] = useState<Record<string, Score>>({});
  const [seek, setSeek] = useState<{ t: number; n: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc("judge_get_showcase", { p_token: token });
    if (e) return setError(e.message);
    const p = data as Panel;
    setPanel(p);
    setDraft(Object.fromEntries(p.choices.map((c) => [c.id, c.my_score ?? { c1: 5, c2: 5, c3: 5, c4: 5 }])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function saveAll() {
    setError(null);
    setSaved(false);
    for (const [choiceId, s] of Object.entries(draft)) {
      const { error: e } = await supabase.rpc("judge_score_showcase", { p_token: token, p_choice_id: choiceId, p_c1: s.c1, p_c2: s.c2, p_c3: s.c3, p_c4: s.c4 });
      if (e) return setError(e.message);
    }
    setSaved(true);
  }

  if (error && !panel) return <p className="mx-auto max-w-2xl px-5 py-10" style={{ color: "var(--danger)" }}>{error}</p>;
  if (!panel) return <p className="mx-auto max-w-2xl px-5 py-10" style={{ color: "var(--text-faint)" }}>Loading…</p>;
  const crit = CRITERIA[panel.showcase.kind];
  const open = panel.showcase.status === "live";

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--red)" }}>
        Judge panel · {panel.judge_name}
      </p>
      <h1 className="mb-3 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        {panel.showcase.title}
      </h1>
      <div className="mb-3">
        <SharedVideoPlayer sourceUrl={panel.showcase.source_url} label={panel.showcase.title} seek={seek} />
      </div>
      <p className="mb-5 text-sm" style={{ color: "var(--text-dim)" }}>
        Score each one 1–10 on {crit.join(", ").toLowerCase()}. You can update your scores until voting closes. Keep this link private.
      </p>
      <div className="flex flex-col gap-3">
        {panel.choices.map((c) => (
          <div key={c.id} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="mb-2 flex items-center gap-3">
              {c.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{c.name}</p>
                {c.team_name && <p className="truncate text-xs" style={{ color: "var(--text-dim)" }}>{c.team_name}</p>}
              </div>
              {c.start_seconds != null && (
                <button type="button" onClick={() => setSeek({ t: c.start_seconds!, n: Date.now() })} className="text-xs font-bold" style={{ color: "var(--red)" }}>
                  ▶ {formatClock(c.start_seconds)}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
              {(["c1", "c2", "c3", "c4"] as const).map((k, i) => (
                <label key={k} className="flex items-center justify-between gap-2 text-xs">
                  {crit[i]}
                  <select
                    disabled={!open}
                    value={draft[c.id]?.[k] ?? 5}
                    onChange={(e) => setDraft((d) => ({ ...d, [c.id]: { ...d[c.id], [k]: Number(e.target.value) } }))}
                    className="rounded-lg border px-1.5 py-1 text-sm"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  >
                    {Array.from({ length: 10 }, (_, n) => n + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      {open ? (
        <button type="button" onClick={saveAll} className="bc-btn-solid mt-4 w-full rounded-full px-4 py-3 text-sm font-bold">
          Save all scores
        </button>
      ) : (
        <p className="mt-4 text-sm" style={{ color: "var(--text-faint)" }}>Judging is closed.</p>
      )}
      {saved && <p className="mt-2 text-sm font-semibold" style={{ color: "var(--red)" }}>✓ Scores saved</p>}
      {error && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
