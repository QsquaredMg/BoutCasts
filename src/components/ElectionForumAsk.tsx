"use client";

import { useState } from "react";

// Public question box for the forum page.
export default function ElectionForumAsk({ id }: { id: string }) {
  const [question, setQuestion] = useState("");
  const [asker, setAsker] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const box = { borderColor: "var(--border)", background: "var(--surface)" } as const;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/school-election/${id}/forum`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, asker }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Couldn't send your question.");
      setQuestion("");
      setMsg({ ok: true, text: "Thanks. A teacher will read your question before it is posted." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't send your question." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="mt-5 grid gap-3 rounded-xl border p-4" style={box}>
      <label className="grid gap-1 text-sm font-bold">
        Your question
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} rows={3} required className="rounded-[10px] border px-3 py-2 font-normal" style={box} />
        <span className="text-xs font-normal" style={{ color: "var(--text-faint)" }}>{question.trim().length}/200</span>
      </label>
      <label className="grid gap-1 text-sm font-bold">
        Your first name or grade (optional)
        <input value={asker} onChange={(e) => setAsker(e.target.value)} maxLength={40} className="rounded-[10px] border px-3 py-2 font-normal" style={box} />
      </label>
      {msg && <p className="text-sm" style={{ color: msg.ok ? "inherit" : "var(--danger)" }} role="status">{msg.text}</p>}
      <button type="submit" disabled={busy || question.trim().length < 10} className="bc-btn-solid rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-50">{busy ? "Sending…" : "Send question"}</button>
    </form>
  );
}
