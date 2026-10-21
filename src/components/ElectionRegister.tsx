"use client";

import { useState } from "react";

export default function ElectionRegister({ id, title, school, deadline, closed }: { id: string; title: string; school: string | null; deadline: string | null; closed: boolean }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const over = closed || (deadline != null && new Date(deadline) <= new Date());
  const box = { borderColor: "var(--border)", background: "var(--surface)" } as const;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/school-election/${id}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Something went wrong.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>{school ?? "School election"}</p>
        <h1 className="text-3xl font-extrabold">Register to vote</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>{title}{deadline && !over ? `. Register by ${new Date(deadline).toLocaleString()}.` : ""}</p>
      </div>
      {over ? (
        <p className="rounded-lg border p-3 text-sm" style={box}>Registration is closed. If you think you should be able to vote, see a teacher.</p>
      ) : done ? (
        <p className="rounded-lg border p-3 text-sm font-semibold" style={box}>Thanks. If your name matches the class list, you are registered. Your teacher will give you your voting code on election day. Not sure? Ask a teacher to check.</p>
      ) : (
        <form onSubmit={submit} className="grid gap-3">
          <label className="grid gap-1 text-sm font-semibold">
            Your first and last name
            <input value={name} onChange={(ev) => setName(ev.target.value)} maxLength={120} autoComplete="off" className="rounded-[10px] border px-3 py-2.5 text-base" style={box} />
          </label>
          {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
          <button type="submit" disabled={busy || !name.trim()} className="bc-btn-solid rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-50">{busy ? "Registering…" : "Register"}</button>
        </form>
      )}
    </div>
  );
}
