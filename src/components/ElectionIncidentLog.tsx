"use client";

import { useCallback, useEffect, useState } from "react";

type Incident = { id: string; reporter_label: string; kind: string; note: string; created_at: string; resolved_at: string | null; resolved_by: string | null; resolution: string | null };

const KINDS: [string, string][] = [
  ["voter_issue", "Voter problem"],
  ["equipment", "Equipment"],
  ["electioneering", "Campaigning near the booth"],
  ["safety", "Safety"],
  ["other", "Other"],
];
const kindLabel = (k: string) => KINDS.find(([v]) => v === k)?.[1] ?? "Other";

// Incident log for poll workers. `deskCode` is a staff seat's code; leave it out when the organizer is signed in.
export default function ElectionIncidentLog({ id, deskCode }: { id: string; deskCode?: string }) {
  const [items, setItems] = useState<Incident[] | null>(null);
  const [role, setRole] = useState<string>("");
  const [kind, setKind] = useState("voter_issue");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const box = { borderColor: "var(--border)", background: "var(--surface)" } as const;
  const headers = useCallback((json: boolean) => ({ ...(json ? { "Content-Type": "application/json" } : {}), ...(deskCode ? { "x-desk-code": deskCode } : {}) }), [deskCode]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/school-election/${id}/incidents`, { cache: "no-store", headers: headers(false) });
    if (!res.ok) return setError("Couldn't load the incident log.");
    const body = await res.json();
    setItems(body.incidents);
    setRole(body.role);
  }, [id, headers]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/school-election/${id}/incidents`, { method: "POST", headers: headers(true), body: JSON.stringify({ kind, note }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Couldn't save the entry.");
      setNote("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the entry.");
    } finally {
      setBusy(false);
    }
  }

  async function resolve(incidentId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/school-election/${id}/incidents`, { method: "PATCH", headers: headers(true), body: JSON.stringify({ incidentId, resolution }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Couldn't save.");
      setResolving(null);
      setResolution("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  const canResolve = role === "owner" || role === "judge";
  const open = (items ?? []).filter((i) => !i.resolved_at).length;

  return (
    <section className="rounded-xl border p-4" style={box} aria-label="Incident log">
      <p className="font-bold">Incident log{items ? ` · ${open} open` : ""}</p>
      <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>Write what happened, where, and when. Do not use student names. A judge or the organizer closes each entry with how it was handled.</p>
      <form onSubmit={add} className="grid gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-[10px] border px-3 py-2 text-sm" style={box} aria-label="Type of incident">
          {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="What happened?" className="rounded-[10px] border px-3 py-2 text-sm" style={box} />
        <button type="submit" disabled={busy || !note.trim()} className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-50" style={{ borderColor: "var(--border)" }}>Add to log</button>
      </form>
      {error && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
      <ul className="mt-3 grid gap-2">
        {(items ?? []).map((i) => (
          <li key={i.id} className="rounded-lg border p-3 text-sm" style={box}>
            <p className="text-xs font-bold" style={{ color: "var(--text-dim)" }}>
              {kindLabel(i.kind)} · {i.reporter_label} · {new Date(i.created_at).toLocaleString()}
            </p>
            <p className="mt-1">{i.note}</p>
            {i.resolved_at ? (
              <p className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>Resolved by {i.resolved_by}: {i.resolution}</p>
            ) : canResolve ? (
              resolving === i.id ? (
                <div className="mt-2 flex gap-2">
                  <input value={resolution} onChange={(e) => setResolution(e.target.value)} maxLength={300} placeholder="How it was handled" className="min-w-0 flex-1 rounded-[10px] border px-3 py-1.5 text-sm" style={box} />
                  <button onClick={() => resolve(i.id)} disabled={busy || !resolution.trim()} className="rounded-full border px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ borderColor: "var(--border)" }}>Save</button>
                </div>
              ) : (
                <button onClick={() => { setResolving(i.id); setResolution(""); }} className="mt-1 text-xs font-bold underline">Mark resolved</button>
              )
            ) : null}
          </li>
        ))}
        {items && items.length === 0 && <li className="text-sm" style={{ color: "var(--text-dim)" }}>Nothing logged yet.</li>}
      </ul>
    </section>
  );
}
