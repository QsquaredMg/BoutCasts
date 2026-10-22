"use client";

import { useCallback, useEffect, useState } from "react";

type Q = { id: string; body: string; asker: string | null; status: "pending" | "approved" | "asked" | "hidden" };

// Organizer controls for the forum: the switch, the share link, and the moderation queue.
export default function ElectionForumPanel({ id, closed, enabled, onChanged }: { id: string; closed: boolean; enabled: boolean; onChanged: () => void }) {
  const [qs, setQs] = useState<Q[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const box = { borderColor: "var(--border)", background: "var(--surface)" } as const;

  const load = useCallback(async () => {
    const res = await fetch(`/api/school-election/${id}/forum`, { cache: "no-store" });
    if (res.ok) setQs((await res.json()).questions);
  }, [id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    setOrigin(window.location.origin);
  }, [load]);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/school-election/${id}/settings`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ forumEnabled: next }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Couldn't save.");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  async function mark(questionId: string, status: Q["status"]) {
    setError(null);
    const res = await fetch(`/api/school-election/${id}/forum`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId, status }) });
    if (!res.ok) setError("Couldn't save.");
    load();
  }

  const group = (s: Q["status"]) => qs.filter((q) => q.status === s);
  const Row = ({ q, actions }: { q: Q; actions: [string, Q["status"]][] }) => (
    <li className="rounded-lg border p-3 text-sm" style={box}>
      <p>{q.body}</p>
      <p className="mt-0.5 text-xs" style={{ color: "var(--text-faint)" }}>{q.asker || "A student"}</p>
      <div className="mt-1 flex gap-3">
        {actions.map(([label, to]) => <button key={to} onClick={() => mark(q.id, to)} className="text-xs font-bold underline">{label}</button>)}
      </div>
    </li>
  );

  return (
    <div className="rounded-xl border p-4" style={box}>
      <p className="font-bold">Debate and forum</p>
      <p className="mb-2 text-xs" style={{ color: "var(--text-faint)" }}>Students send questions for the candidates. You approve each one before it shows on the public page, and mark the ones you ask at the debate.</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} disabled={busy || closed} onChange={(e) => toggle(e.target.checked)} />
        Open the question box
      </label>
      {enabled && <p className="ml-6 break-all text-xs">Share with students: {origin}/school-election/{id}/forum</p>}
      <p className="mt-2 text-sm"><a href={`/school-election/${id}/debate`} className="font-bold underline">Open the equal-time debate timer</a> <span className="text-xs" style={{ color: "var(--text-faint)" }}>(organizer or a judge seat)</span></p>
      {error && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
      {enabled && (
        <div className="mt-3 grid gap-4">
          <div>
            <p className="mb-1 text-sm font-bold">Waiting for approval ({group("pending").length})</p>
            <ul className="grid gap-2">
              {group("pending").map((q) => <Row key={q.id} q={q} actions={[["Approve", "approved"], ["Hide", "hidden"]]} />)}
              {group("pending").length === 0 && <li className="text-sm" style={{ color: "var(--text-dim)" }}>None waiting.</li>}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-sm font-bold">Approved ({group("approved").length})</p>
            <ul className="grid gap-2">
              {group("approved").map((q) => <Row key={q.id} q={q} actions={[["Mark asked at debate", "asked"], ["Hide", "hidden"]]} />)}
            </ul>
          </div>
          {(group("asked").length > 0 || group("hidden").length > 0) && (
            <div>
              <p className="mb-1 text-sm font-bold">Asked ({group("asked").length}) and hidden ({group("hidden").length})</p>
              <ul className="grid gap-2">
                {group("asked").map((q) => <Row key={q.id} q={q} actions={[["Back to approved", "approved"]]} />)}
                {group("hidden").map((q) => <Row key={q.id} q={q} actions={[["Restore", "pending"]]} />)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
