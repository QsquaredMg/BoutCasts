"use client";

import { useState } from "react";

// Roster import from School-B-Doo: pick the classes allowed to vote (for example only seniors for a senior class vote).
type Klass = { year: number; label: string; count: number };

export default function SbdRosterImport({ id, onDone }: { id: string; onDone: () => void }) {
  const [classes, setClasses] = useState<Klass[] | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function post(payload: object) {
    const res = await fetch(`/api/school-election/${id}/sbd-roster`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Something went wrong.");
    return j;
  }

  async function load() {
    setBusy(true); setMsg(null);
    try { setClasses((await post({ action: "preview" })).classes as Klass[]); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Something went wrong." }); }
    setBusy(false);
  }

  async function run() {
    setBusy(true); setMsg(null);
    try {
      const j = await post({ action: "import", years: picked });
      const sk = j.skipped ?? {};
      const extra = [sk.already ? `${sk.already} already on the roster` : "", sk.sameName ? `${sk.sameName} skipped for sharing a name with another student` : "", sk.candidates ? `${sk.candidates} skipped because they are candidates or staff` : ""].filter(Boolean).join(", ");
      setMsg({ ok: true, text: `Added ${j.added} student${j.added === 1 ? "" : "s"}.${extra ? ` ${extra}.` : ""} Each student sees their own code in School-B-Doo.` });
      setPicked([]);
      onDone();
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Something went wrong." }); }
    setBusy(false);
  }

  return (
    <div className="mt-3 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <p className="text-sm font-bold">Add students from School-B-Doo</p>
      <p className="text-xs" style={{ color: "var(--text-dim)" }}>Only verified students of the linked school. We bring over names and class year, and each student sees their own code in the School-B-Doo app.</p>
      {!classes ? (
        <button onClick={load} disabled={busy} className="mt-2 rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-50" style={{ borderColor: "var(--border)" }}>{busy ? "Loading…" : "Choose classes"}</button>
      ) : classes.length === 0 ? (
        <p className="mt-2 text-sm">No verified students found yet at that school.</p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            {classes.map((c) => (
              <label key={c.year} className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>
                <input type="checkbox" checked={picked.includes(c.year)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, c.year] : p.filter((y) => y !== c.year)))} />
                {c.label} <span style={{ color: "var(--text-dim)" }}>({c.count})</span>
              </label>
            ))}
          </div>
          <button onClick={run} disabled={busy || !picked.length} className="bc-btn-solid mt-3 rounded-full px-4 py-2 text-sm font-bold disabled:opacity-50">{busy ? "Adding…" : "Add these students"}</button>
        </>
      )}
      {msg && <p className="mt-2 text-sm font-semibold" style={{ color: msg.ok ? "var(--text)" : "#c0392b" }} role="status">{msg.text}</p>}
    </div>
  );
}
