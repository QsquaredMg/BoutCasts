"use client";

import { useCallback, useEffect, useState } from "react";
import JudgeInviteButton from "@/components/JudgeInviteButton";
import { createClient } from "@/lib/supabase/client";
import JudgedResults from "@/components/JudgedResults";
import { formatClipTime, type JudgeNote } from "@/components/JudgeOptionNotes";

// Organizer-side controls for a judges-panel event: invite judges (each gets
// a private link, no account needed), track who has submitted, see the
// scoreboard, and release results to the public page.

type JudgeRow = { id: string; name: string; token: string; submitted_at: string | null };

export default function JudgePanelManager({
  eventId,
  status,
  resultsReleased,
  onChanged,
  optionNames,
  eventTitle,
  closesAt,
}: {
  eventId: string;
  status: "draft" | "live" | "closed";
  resultsReleased: boolean;
  onChanged: () => void;
  optionNames: Record<string, string>;
  eventTitle: string;
  closesAt?: string | null;
}) {
  const supabase = createClient();
  const [judges, setJudges] = useState<JudgeRow[]>([]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notes, setNotes] = useState<JudgeNote[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("live_vote_judges")
      .select("id, name, token, submitted_at")
      .eq("event_id", eventId)
      .order("created_at");
    setJudges(data ?? []);
    const { data: noteRows } = await supabase.rpc("get_judge_notes", { p_event_id: eventId });
    setNotes((noteRows as JudgeNote[] | null) ?? []);
    setRefreshKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // Keep submission progress fresh while judges are scoring.
    const t = setInterval(() => {
      if (!document.hidden) load();
    }, 15_000);
    return () => clearInterval(t);
  }, [load]);

  function linkFor(token: string) {
    return `${window.location.origin}/judge/${token}`;
  }

  async function addJudge(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    const { error: insertError } = await supabase.from("live_vote_judges").insert({ event_id: eventId, name });
    setBusy(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewName("");
    load();
  }

  async function removeJudge(j: JudgeRow) {
    if (!confirm(`Remove ${j.name}? Their link stops working and any scores they entered are deleted.`)) return;
    const { error: delError } = await supabase.from("live_vote_judges").delete().eq("id", j.id);
    if (delError) setError(delError.message);
    load();
  }

  function copyLink(j: JudgeRow) {
    navigator.clipboard.writeText(linkFor(j.token)).then(() => {
      setCopiedId(j.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  async function toggleRelease() {
    const next = !resultsReleased;
    if (next && !confirm("Release the judges' scoreboard on the public page?")) return;
    setBusy(true);
    const { error: rpcError } = await supabase.rpc("set_judged_results_released", {
      p_event_id: eventId,
      p_released: next,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onChanged();
  }

  const box = { borderColor: "var(--border)", background: "var(--surface)" };
  const canEditJudges = status !== "closed";

  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="rounded-xl border p-3.5" style={box}>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
          Judges
        </p>
        <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
          Each judge gets a private link — send it to them by text or email. No account needed.
          {status === "draft" && " Judges can open their link now, but scoring opens when the event goes live."}
        </p>

        {judges.length === 0 && (
          <p className="mb-3 text-sm" style={{ color: "var(--text-faint)" }}>
            No judges yet.
          </p>
        )}
        <ul className="mb-3 flex flex-col gap-2">
          {judges.map((j) => (
            <li
              key={j.id}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)" }}
            >
              <span className="flex-1 truncate font-semibold">{j.name}</span>
              <span className="text-xs" style={{ color: j.submitted_at ? "var(--red)" : "var(--text-faint)" }}>
                {j.submitted_at ? "✓ Submitted" : "Not submitted"}
              </span>
              <button
                type="button"
                onClick={() => copyLink(j)}
                className="rounded-full border px-2.5 py-1 text-xs font-semibold"
                style={{ borderColor: "var(--border)" }}
              >
                {copiedId === j.id ? "Copied!" : "Copy link"}
              </button>
              <JudgeInviteButton judgeName={j.name} link={linkFor(j.token)} title={eventTitle} kind="competition" deadline={closesAt} />
              {canEditJudges && (
                <button
                  type="button"
                  onClick={() => removeJudge(j)}
                  className="px-1 text-xs"
                  style={{ color: "var(--text-faint)" }}
                  aria-label={`Remove ${j.name}`}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>

        {canEditJudges && (
          <form onSubmit={addJudge} className="flex gap-2">
            <input
              className="flex-1 rounded-[10px] border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              placeholder="Judge's name"
              maxLength={80}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy || !newName.trim()}
              className="bc-btn-solid rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60"
            >
              Add judge
            </button>
          </form>
        )}
        {error && (
          <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
      </div>

      {status !== "draft" && (
        <>
          <JudgedResults eventId={eventId} status={status} refreshKey={refreshKey} />
          <button
            type="button"
            onClick={toggleRelease}
            disabled={busy}
            className={
              resultsReleased
                ? "rounded-full border px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                : "bc-btn-solid rounded-full px-5 py-3 text-sm font-bold disabled:opacity-60"
            }
            style={resultsReleased ? { borderColor: "var(--border)", color: "var(--text-dim)" } : undefined}
          >
            {resultsReleased ? "Hide results from the public page" : "Release results to the public page"}
          </button>

          <div className="rounded-xl border p-3.5" style={box}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
              Judges&apos; notes ({notes.length})
            </p>
            {notes.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>
                No notes yet. Judges can add private, time-stamped notes on each contestant.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {Object.entries(optionNames)
                  .filter(([id]) => notes.some((n) => n.option_id === id))
                  .map(([id, name]) => (
                    <div key={id}>
                      <p className="mb-1 text-sm font-semibold">{name}</p>
                      <ul className="flex flex-col gap-1.5">
                        {notes
                          .filter((n) => n.option_id === id)
                          .map((n) => (
                            <li key={n.id} className="rounded-lg px-2.5 py-1.5 text-sm" style={{ background: "var(--surface-2)" }}>
                              <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                                <b style={{ color: "var(--text-dim)" }}>{n.judge_name}</b> ·{" "}
                                {new Date(n.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                                {n.clip_seconds !== null && (
                                  <b className="ml-1" style={{ color: "var(--red)" }}>
                                    @ {formatClipTime(n.clip_seconds)}
                                  </b>
                                )}
                              </p>
                              <p className="whitespace-pre-wrap">{n.body}</p>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
