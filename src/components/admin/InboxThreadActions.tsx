"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { INBOX_SENDERS } from "@/lib/inbox";

async function post(body: Record<string, unknown>): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await fetch("/api/admin/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return await res.json();
  } catch {
    return { error: "Network problem. Try again." };
  }
}

// Reply box plus open/done toggle for one conversation. Opening it marks the messages read.
export default function InboxThreadActions({ threadId, status, unread }: { threadId: string; status: "open" | "done"; unread: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [from, setFrom] = useState<string>(INBOX_SENDERS[0].key);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!unread) return;
    post({ action: "read", threadId }).then(() => router.refresh());
  }, [unread, threadId, router]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await post({ action: "reply", threadId, text, from });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Could not send.");
    setText("");
    router.refresh();
  }

  async function toggle() {
    setBusy(true);
    await post({ action: status === "done" ? "open" : "done", threadId });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-4">
      <form onSubmit={send} className="flex flex-col gap-2">
        <label htmlFor="inbox-reply" className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>Reply</label>
        <textarea id="inbox-reply" value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={20000} className="w-full rounded-xl border bg-transparent p-3 text-sm" style={{ borderColor: "var(--border)" }} placeholder="Write your reply. It threads with the original." />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            Send from
            <select value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border bg-transparent px-2 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
              {INBOX_SENDERS.map((s) => <option key={s.key} value={s.key}>{s.address}</option>)}
            </select>
          </label>
          <button type="submit" disabled={busy || !text.trim()} className="bc-btn-red rounded-full px-5 py-2 text-sm font-bold disabled:opacity-60">{busy ? "Sending…" : "Send reply"}</button>
          <button type="button" onClick={toggle} disabled={busy} className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-60" style={{ borderColor: "var(--border)" }}>
            {status === "done" ? "Reopen" : "Mark done"}
          </button>
        </div>
        {error && <p role="alert" className="text-sm font-semibold" style={{ color: "var(--red)" }}>{error}</p>}
      </form>
    </div>
  );
}
