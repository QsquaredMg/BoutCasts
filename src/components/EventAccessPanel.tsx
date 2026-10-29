"use client";

import { useCallback, useEffect, useState } from "react";
import { KIND_LABEL, type EventKind } from "@/lib/eventRoles";

type Row = {
  id: string;
  role: "moderator" | "owner";
  email: string;
  status: "pending" | "active" | "declined" | "expired";
  username: string | null;
  expires_at: string;
};

// Owner / admin panel: invite a moderator, or hand the whole event to someone else.
export default function EventAccessPanel({ kind, eventId }: { kind: EventKind; eventId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"moderator" | "owner">("moderator");
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; link?: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/event-roles?kind=${kind}&eventId=${eventId}`, { cache: "no-store" });
    if (res.ok) setRows((await res.json()).roles as Row[]);
    else setRows([]);
  }, [kind, eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function invite(e?: string, r?: "moderator" | "owner") {
    const to = (e ?? email).trim();
    const which = r ?? role;
    if (!to) return;
    if (which === "owner" && !confirm(`Hand this ${KIND_LABEL[kind]} to ${to}? When they accept, they become the owner and you lose owner access${keep ? " (you stay on as a moderator)" : ""}. Earnings already made stay with you.`)) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/event-roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, eventId, email: to, role: which, keepAccess: keep }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: data.error ?? "Couldn't send the invite." });
      return;
    }
    setMsg(
      data.emailed
        ? { ok: true, text: `Invitation emailed to ${to}. It works for 14 days.` }
        : { ok: true, text: `Invitation created for ${to}. Email isn't set up, so send them this link yourself:`, link: data.link },
    );
    if (e === undefined) setEmail("");
    load();
  }

  async function revoke(id: string) {
    if (!confirm("Remove this access?")) return;
    const res = await fetch(`/api/event-roles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMsg({ ok: false, text: data.error ?? "Couldn't remove." });
    load();
  }

  const input = "w-full rounded-[10px] border bg-transparent px-3 py-2 text-sm";
  const live = (rows ?? []).filter((r) => r.status !== "declined");

  return (
    <section className="mt-8 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <h2 className="text-base font-extrabold">Who can run this {KIND_LABEL[kind]}</h2>
      <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
        A <b>moderator</b> runs the event day to day (candidates, results, closing) but never sees payments, earnings or Super Vote
        settings. <b>Handing over</b> makes someone the owner. The person must sign in with the email you enter.
      </p>

      {rows === null ? (
        <p className="mt-3 text-sm" style={{ color: "var(--text-faint)" }}>Loading…</p>
      ) : live.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: "var(--text-dim)" }}>Only you right now.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {live.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{r.username ? `@${r.username}` : r.email}</span>
                <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
                  {r.email} · {r.role === "owner" ? "Taking over" : "Moderator"} ·{" "}
                  {r.status === "active" ? "Active" : r.status === "expired" ? "Invite expired" : "Invite sent"}
                </span>
              </span>
              <span className="flex gap-2">
                {(r.status === "pending" || r.status === "expired") && (
                  <button type="button" disabled={busy} onClick={() => invite(r.email, r.role)} className="rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: "var(--border)" }}>
                    Resend
                  </button>
                )}
                <button type="button" onClick={() => revoke(r.id)} className="rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: "var(--border)", color: "var(--danger)" }}>
                  {r.status === "active" ? "Remove" : "Cancel"}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input type="email" inputMode="email" autoComplete="off" className={input} style={{ borderColor: "var(--border)" }} placeholder="their@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select className={input} style={{ borderColor: "var(--border)" }} value={role} onChange={(e) => setRole(e.target.value as "moderator" | "owner")} aria-label="Access level">
          <option value="moderator">Moderator</option>
          <option value="owner">Hand over ownership</option>
        </select>
      </div>
      {role === "owner" && (
        <label className="mt-2 flex items-center gap-2 text-xs">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="h-4 w-4" />
          Keep me on as a moderator after the hand-over
        </label>
      )}
      <button type="button" onClick={() => invite()} disabled={busy || !email.trim()} className="bc-btn-solid mt-3 rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-60">
        {busy ? "Sending…" : role === "owner" ? "Send hand-over invite" : "Send invite"}
      </button>
      {msg && (
        <div role="status" className="mt-3 text-sm font-semibold" style={{ color: msg.ok ? "var(--blue)" : "var(--danger)" }}>
          {msg.text}
          {msg.link && <input readOnly value={msg.link} onFocus={(e) => e.currentTarget.select()} className={`${input} mt-2 font-mono text-xs`} style={{ borderColor: "var(--border)" }} />}
        </div>
      )}
    </section>
  );
}
