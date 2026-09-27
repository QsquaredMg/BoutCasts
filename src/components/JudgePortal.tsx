"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ClipPlayer from "@/components/ClipPlayer";
import EmbeddedClipPlayer from "@/components/EmbeddedClipPlayer";
import { displayClip } from "@/lib/liveVoteEvents/displayClip";

// Judge scoring screen, reached by a private link. Every tap saves right
// away, so a judge can close the tab and pick up where they left off.

type Assignment = {
  judge: { id: string; name: string; submitted_at: string | null };
  event: {
    id: string;
    title: string;
    description: string | null;
    status: "draft" | "live" | "closed";
    closes_at: string | null;
    brand_name: string | null;
    brand_logo_url: string | null;
  };
  criteria: { id: string; name: string }[];
  options: {
    id: string;
    name: string;
    source_type: string;
    source_url: string | null;
    description: string | null;
    thumbnail_url: string | null;
  }[];
  scores: { option_id: string; criterion_id: string | null; score: number }[];
};

const OVERALL = "overall";
const keyFor = (optionId: string, criterionId: string | null) => `${optionId}:${criterionId ?? OVERALL}`;

export default function JudgePortal({ token }: { token: string }) {
  const supabase = createClient();
  const [data, setData] = useState<Assignment | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadedAt, setLoadedAt] = useState(0);

  const load = useCallback(async () => {
    const { data: res, error: rpcError } = await supabase.rpc("judge_get_assignment", { p_token: token });
    if (rpcError) {
      setLoadError(rpcError.message);
      return;
    }
    const a = res as Assignment;
    setData(a);
    setLoadedAt(Date.now());
    const next: Record<string, number> = {};
    for (const s of a.scores) next[keyFor(s.option_id, s.criterion_id)] = s.score;
    setScores(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (loadError) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Link not valid
        </h1>
        <p style={{ color: "var(--text-dim)" }}>
          This judging link doesn&apos;t work — it may have been removed by the organizer. Ask them
          for a new one.
        </p>
      </div>
    );
  }
  if (!data) return <p style={{ color: "var(--text-faint)" }}>Loading…</p>;

  const { event, judge, options } = data;
  const criteria: { id: string | null; name: string }[] =
    data.criteria.length > 0 ? data.criteria : [{ id: null, name: "Overall score" }];
  const open =
    event.status === "live" && (!event.closes_at || new Date(event.closes_at).getTime() > loadedAt);
  const needed = options.length * criteria.length;
  const done = options.reduce(
    (n, o) => n + criteria.filter((c) => scores[keyFor(o.id, c.id)] !== undefined).length,
    0
  );

  async function setScore(optionId: string, criterionId: string | null, score: number) {
    if (!open) return;
    const k = keyFor(optionId, criterionId);
    const previous = scores[k];
    setScores((prev) => ({ ...prev, [k]: score }));
    setSaving(k);
    setError(null);
    const { error: rpcError } = await supabase.rpc("judge_submit_scores", {
      p_token: token,
      p_scores: [{ option_id: optionId, criterion_id: criterionId, score }],
      p_final: false,
    });
    setSaving(null);
    if (rpcError) {
      setScores((prev) => {
        const next = { ...prev };
        if (previous === undefined) delete next[k];
        else next[k] = previous;
        return next;
      });
      setError(rpcError.message);
    }
  }

  async function submitFinal() {
    setSubmitting(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("judge_submit_scores", {
      p_token: token,
      p_scores: [],
      p_final: true,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    load();
  }

  return (
    <div>
      {(event.brand_name || event.brand_logo_url) && (
        <div className="mb-3 flex items-center gap-2.5">
          {event.brand_logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.brand_logo_url}
              alt=""
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

      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--red)" }}>
        Judging as {judge.name}
      </p>
      <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        {event.title}
      </h1>
      {event.description && (
        <p className="mb-3 text-sm" style={{ color: "var(--text-faint)" }}>
          {event.description}
        </p>
      )}

      <div className="mb-4 rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
        {event.status === "draft" && "Scoring opens when the organizer takes the event live. You can review the contestants now."}
        {open && (
          <>
            Score each contestant from 1 (low) to 10 (high). Every tap saves automatically — you can
            change scores until judging closes
            {event.closes_at ? ` at ${new Date(event.closes_at).toLocaleString()}` : ""}.
          </>
        )}
        {!open && event.status !== "draft" && "Judging is closed. Thanks for judging!"}
      </div>

      {error && (
        <p className="mb-4 rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--red)" }}>
          {error}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {options.map((option) => {
          const clip = displayClip(option);
          return (
            <div
              key={option.id}
              className="rounded-xl border p-3"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <p className="mb-2 font-semibold">{option.name}</p>
              {clip?.kind === "hosted" && <ClipPlayer src={clip.url} isAudio={clip.isAudio} label={option.name} />}
              {clip?.kind === "embed" && <EmbeddedClipPlayer sourceUrl={clip.url} label={option.name} />}
              {clip?.kind === "link" && (
                <a href={clip.url} target="_blank" rel="noreferrer" className="text-sm font-semibold underline" style={{ color: "var(--red)" }}>
                  Watch clip ↗
                </a>
              )}
              {option.description && (
                <p className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>
                  {option.description}
                </p>
              )}

              <div className="mt-3 flex flex-col gap-3">
                {criteria.map((c) => {
                  const k = keyFor(option.id, c.id);
                  const current = scores[k];
                  return (
                    <div key={k}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                          {c.name}
                        </span>
                        <span style={{ color: "var(--text-faint)" }}>
                          {saving === k ? "Saving…" : current !== undefined ? `${current}/10` : "Not scored"}
                        </span>
                      </div>
                      <div className="grid grid-cols-10 gap-1" role="radiogroup" aria-label={`${c.name} for ${option.name}`}>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                          const active = current === n;
                          return (
                            <button
                              key={n}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              aria-label={`${n}`}
                              disabled={!open}
                              onClick={() => setScore(option.id, c.id, n)}
                              className="h-9 rounded-md border text-sm font-bold disabled:opacity-50"
                              style={
                                active
                                  ? { background: "var(--red)", borderColor: "var(--red)", color: "#fff" }
                                  : { borderColor: "var(--border)", color: "var(--text-dim)" }
                              }
                            >
                              {n}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {open && (
        <div
          className="sticky bottom-3 mt-5 rounded-xl border p-3.5 shadow-lg"
          style={{ borderColor: done === needed ? "var(--red)" : "var(--border)", background: "var(--surface)" }}
        >
          <div className="mb-2 flex justify-between text-xs">
            <span className="font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
              {judge.submitted_at ? "✓ Scores submitted" : "Your progress"}
            </span>
            <span style={{ color: "var(--text-faint)" }}>
              {done}/{needed} scored
            </span>
          </div>
          <div className="mb-3 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
            <div className="h-full rounded-full" style={{ width: `${needed ? (done / needed) * 100 : 0}%`, background: "var(--red)" }} />
          </div>
          {judge.submitted_at ? (
            <p className="text-center text-xs" style={{ color: "var(--text-faint)" }}>
              The organizer can see you&apos;re done. Changes still save until judging closes.
            </p>
          ) : (
            <button
              type="button"
              onClick={submitFinal}
              disabled={submitting || done < needed}
              className="w-full rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: "var(--red)" }}
            >
              {submitting ? "Submitting…" : done < needed ? `Score all ${needed} to submit` : "Submit my scores"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
