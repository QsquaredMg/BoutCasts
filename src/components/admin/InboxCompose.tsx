"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INBOX_SENDERS } from "@/lib/inbox";

// Write a brand-new email from support@ or info@. It is saved in the inbox as a finished conversation.
export default function InboxCompose() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<string>(INBOX_SENDERS[1].key);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    let r: { ok?: boolean; error?: string; threadId?: string };
    try {
      const res = await fetch("/api/admin/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "compose", from, to, subject, text }) });
      r = await res.json();
    } catch {
      r = { error: "Network problem. Try again." };
    }
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Could not send.");
    setTo("");
    setSubject("");
    setText("");
    setOpen(false);
    router.push(`/admin/inbox?f=done&t=${encodeURIComponent(r.threadId ?? "")}`);
  }

  const field = "w-full rounded-xl border bg-transparent p-2.5 text-sm";
  const border = { borderColor: "var(--border)" };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="bc-btn-red mb-4 rounded-full px-5 py-2 text-sm font-bold">
        New email
      </button>
    );
  }
  return (
    <form onSubmit={send} className="bc-card mb-4 flex flex-col gap-2 p-4">
      <label className="flex items-center gap-2 text-sm font-semibold">
        From
        <select value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border bg-transparent px-2 py-1.5 text-sm" style={border}>
          {INBOX_SENDERS.map((s) => <option key={s.key} value={s.key}>{s.address}</option>)}
        </select>
      </label>
      <input type="email" required value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" aria-label="To" className={field} style={border} />
      <input type="text" required value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder="Subject" aria-label="Subject" className={field} style={border} />
      <textarea required value={text} onChange={(e) => setText(e.target.value)} rows={8} maxLength={20000} placeholder="Message" aria-label="Message" className={field} style={border} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy || !to.trim() || !subject.trim() || !text.trim()} className="bc-btn-red rounded-full px-5 py-2 text-sm font-bold disabled:opacity-60">{busy ? "Sending…" : "Send"}</button>
        <button type="button" onClick={() => setOpen(false)} disabled={busy} className="rounded-full border px-4 py-2 text-sm font-bold" style={border}>Cancel</button>
      </div>
      {error && <p role="alert" className="text-sm font-semibold" style={{ color: "var(--red)" }}>{error}</p>}
    </form>
  );
}
