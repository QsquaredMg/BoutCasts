"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type PushTarget = {
  type: "bout" | "live_vote";
  id: string;
  label: string;
  detail: string;
  votes: number;
  link: string;
};

export type BroadcastRow = {
  id: string;
  title: string;
  body: string;
  link: string;
  devices_targeted: number;
  devices_delivered: number;
  inbox_recipients: number;
  created_at: string;
};

export default function AdminPushComposer({
  targets,
  deviceCount,
  history,
}: {
  targets: PushTarget[];
  deviceCount: number;
  history: BroadcastRow[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "bout" | "live_vote">("all");
  const [selected, setSelected] = useState<PushTarget | null>(null);
  const [customLink, setCustomLink] = useState("/");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [inbox, setInbox] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => targets.filter((t) => filter === "all" || t.type === filter).slice(0, 12), [targets, filter]);

  function pick(t: PushTarget) {
    setSelected(t);
    setResult(null);
    setError(null);
    if (t.type === "bout") {
      setTitle("🔥 Bout heating up on BoutCasts");
      setMessage(`${t.detail} — ${t.votes.toLocaleString()} vote${t.votes === 1 ? "" : "s"} so far. Cast yours now!`);
    } else {
      setTitle("🗳️ Live Vote happening now");
      setMessage(`${t.label} — ${t.votes.toLocaleString()} vote${t.votes === 1 ? "" : "s"} and counting. Make your pick!`);
    }
  }

  async function send() {
    const link = selected ? selected.link : customLink;
    if (
      !confirm(
        `Send "${title}" to ${deviceCount.toLocaleString()} device${deviceCount === 1 ? "" : "s"}${inbox ? " and every account's notification bell" : ""}?`
      )
    )
      return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          link,
          targetType: selected ? selected.type : "custom",
          targetId: selected?.id ?? null,
          inbox,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't send.");
      setResult(
        `Sent to ${data.delivered} of ${data.devices} device${data.devices === 1 ? "" : "s"}` +
          (data.removed ? ` (${data.removed} old device${data.removed === 1 ? "" : "s"} removed)` : "") +
          (inbox ? `, and added to ${data.inboxRecipients} notification bell${data.inboxRecipients === 1 ? "" : "s"}.` : ".")
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      setSending(false);
    }
  }

  const card = { borderColor: "var(--border)", background: "var(--surface)" };
  const input = "w-full rounded-[10px] border px-3 py-2 text-sm";

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border p-3 text-sm" style={card}>
        <b>{deviceCount.toLocaleString()}</b> device{deviceCount === 1 ? "" : "s"} have notifications turned on.
      </div>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            1. Pick what to promote (most votes first)
          </p>
          <div className="flex gap-1.5">
            {(
              [
                ["all", "All"],
                ["bout", "Bouts"],
                ["live_vote", "Live Votes"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setFilter(k)} className={`bc-chip${filter === k ? " active" : ""}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {shown.length === 0 && (
            <p className="text-sm" style={{ color: "var(--text-faint)" }}>
              Nothing live right now.
            </p>
          )}
          {shown.map((t) => {
            const active = selected?.id === t.id;
            return (
              <button
                key={`${t.type}-${t.id}`}
                type="button"
                onClick={() => pick(t)}
                className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-left"
                style={{ ...card, borderColor: active ? "var(--red)" : "var(--border)" }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {t.type === "bout" ? "🥊 " : "🗳️ "}
                    {t.label}
                  </span>
                  <span className="block truncate text-xs" style={{ color: "var(--text-faint)" }}>
                    {t.detail}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-bold" style={{ color: "var(--red)" }}>
                  {t.votes.toLocaleString()} votes
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setTitle("");
              setMessage("");
            }}
            className="text-left text-xs font-semibold underline"
            style={{ color: "var(--text-dim)" }}
          >
            Or send about any other page
          </button>
        </div>
      </section>

      <section className="rounded-xl border p-4" style={card}>
        <p className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
          2. Write the notification
        </p>
        {!selected && (
          <label className="mb-3 block text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
            Page it opens (starts with /)
            <input value={customLink} onChange={(e) => setCustomLink(e.target.value)} className={`${input} mt-1`} style={card} />
          </label>
        )}
        {selected && (
          <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
            Opens: <code>{selected.link}</code>
          </p>
        )}
        <label className="mb-3 block text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
          Title ({title.length}/80)
          <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className={`${input} mt-1`} style={card} />
        </label>
        <label className="mb-3 block text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
          Message ({message.length}/200)
          <textarea
            value={message}
            maxLength={200}
            rows={3}
            onChange={(e) => setMessage(e.target.value)}
            className={`${input} mt-1`}
            style={card}
          />
        </label>

        {(title || message) && (
          <div className="mb-3 rounded-2xl p-3" style={{ background: "#0a0e1a", color: "#fff" }}>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#9fb8ff" }}>
              Preview · BoutCasts
            </p>
            <p className="text-sm font-bold">{title || "Title"}</p>
            <p className="text-xs" style={{ color: "#c9d0e0" }}>
              {message || "Message"}
            </p>
          </div>
        )}

        <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--red)]" checked={inbox} onChange={(e) => setInbox(e.target.checked)} />
          Also add it to every account&apos;s notification bell (reaches people without push on)
        </label>

        <button
          type="button"
          onClick={send}
          disabled={sending || !title.trim() || !message.trim()}
          className="bc-btn-solid w-full rounded-full px-4 py-3 text-sm font-bold disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send notification"}
        </button>
        {result && (
          <p className="mt-2 text-sm font-semibold" style={{ color: "var(--red)" }}>
            ✓ {result}
          </p>
        )}
        {error && (
          <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
      </section>

      {history.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            Recently sent
          </p>
          <div className="flex flex-col gap-1.5">
            {history.map((h) => (
              <div key={h.id} className="rounded-lg border p-2.5 text-sm" style={card}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold">{h.title}</span>
                  <span className="shrink-0 text-[11px]" style={{ color: "var(--text-faint)" }}>
                    {new Date(h.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
                <p className="truncate text-xs" style={{ color: "var(--text-dim)" }}>
                  {h.body}
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {h.devices_delivered}/{h.devices_targeted} devices · {h.inbox_recipients} bells · {h.link}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
