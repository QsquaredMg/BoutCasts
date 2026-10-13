"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type QueueRow = {
  id: string; kind: string; title: string; winner: string | null; status: string;
  caption_facebook: string; caption_instagram: string; error: string | null; created_at: string;
};
type Mode = "off" | "approve" | "auto";

const MODES: { key: Mode; label: string; hint: string }[] = [
  { key: "approve", label: "Approve first", hint: "Results wait here for your OK." },
  { key: "auto", label: "Fully automatic", hint: "Results post by themselves within an hour." },
  { key: "off", label: "Paused", hint: "Nothing is queued or posted." },
];

export default function SocialQueue({ initial, mode: initialMode, facebookReady, instagramReady }: { initial: QueueRow[]; mode: Mode; facebookReady: boolean; instagramReady: boolean }) {
  const supabase = createClient();
  const [rows, setRows] = useState(initial);
  const [mode, setMode] = useState(initialMode);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function setModeTo(m: Mode) {
    const { error } = await supabase.from("social_settings").update({ mode: m }).eq("id", 1);
    if (error) setMsg("Couldn't change the mode."); else setMode(m);
  }
  function edit(id: string, patch: Partial<QueueRow>) {
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  async function act(row: QueueRow, action: "publish" | "skip" | "save") {
    setBusy(row.id); setMsg(null);
    const res = await fetch(`/api/admin/social/${row.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, caption_facebook: row.caption_facebook, caption_instagram: row.caption_instagram }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setMsg(json.error ?? "That didn't work."); }
    if (action === "skip" && res.ok) edit(row.id, { status: "skipped" });
    if (action === "publish") edit(row.id, { status: res.ok ? "posted" : "failed", error: json.error ?? null });
    if (action === "save" && res.ok) setMsg("Captions saved.");
  }

  const box = { borderColor: "var(--border)", background: "var(--surface)" } as const;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border p-4" style={box}>
        <div className="mb-2 flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button key={m.key} onClick={() => setModeTo(m.key)} aria-pressed={mode === m.key}
              className="rounded-lg border px-3 py-1.5 text-sm font-bold"
              style={{ borderColor: mode === m.key ? "var(--red)" : "var(--border)", color: mode === m.key ? "var(--red)" : "inherit" }}>
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>{MODES.find((m) => m.key === mode)?.hint}</p>
        <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
          Facebook Page: {facebookReady ? "connected" : "not connected"} · Instagram: {instagramReady ? "connected" : "not connected"}
        </p>
        {msg && <p role="status" className="mt-2 text-sm font-semibold">{msg}</p>}
      </div>

      {rows.length === 0 && <p className="text-sm" style={{ color: "var(--text-faint)" }}>Nothing queued yet. Finished results appear here within an hour.</p>}

      {rows.map((r) => {
        const open = r.status === "pending" || r.status === "failed" || r.status === "partial";
        return (
          <section key={r.id} className="grid gap-4 rounded-2xl border p-4 sm:grid-cols-[200px_1fr]" style={box}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/social/card/${r.id}`} alt={`Result card for ${r.title}`} className="w-full rounded-lg" loading="lazy" />
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold">{r.title}</h2>
                <span className="rounded-full border px-2 py-0.5 text-xs font-semibold uppercase" style={{ borderColor: "var(--border)" }}>{r.kind}</span>
                <span className="text-xs font-bold" style={{ color: r.status === "posted" ? "var(--green, #1a8f5a)" : r.status === "failed" ? "var(--danger)" : "var(--text-dim)" }}>{r.status}</span>
              </div>
              {r.error && <p className="mb-2 text-xs" style={{ color: "var(--danger)" }}>{r.error}</p>}
              {open ? (
                <>
                  <label className="text-xs font-semibold" htmlFor={`fb-${r.id}`}>Facebook caption</label>
                  <textarea id={`fb-${r.id}`} value={r.caption_facebook} onChange={(e) => edit(r.id, { caption_facebook: e.target.value })} rows={6} className="mb-2 w-full rounded-lg border p-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg)" }} />
                  <label className="text-xs font-semibold" htmlFor={`ig-${r.id}`}>Instagram caption</label>
                  <textarea id={`ig-${r.id}`} value={r.caption_instagram} onChange={(e) => edit(r.id, { caption_instagram: e.target.value })} rows={6} className="mb-2 w-full rounded-lg border p-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--bg)" }} />
                  <div className="flex flex-wrap gap-2">
                    <button disabled={busy === r.id} onClick={async () => { await act(r, "save"); await act(r, "publish"); }} className="rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ background: "var(--red)" }}>
                      {busy === r.id ? "Posting…" : r.status === "pending" ? "Approve & post" : "Retry"}
                    </button>
                    <button disabled={busy === r.id} onClick={() => act(r, "save")} className="rounded-lg border px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>Save captions</button>
                    <button disabled={busy === r.id} onClick={() => act(r, "skip")} className="rounded-lg border px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>Skip</button>
                  </div>
                </>
              ) : (
                <p className="text-sm" style={{ color: "var(--text-dim)" }}>{r.winner ? `Winner: ${r.winner}` : ""}</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
