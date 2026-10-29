"use client";

import { useState } from "react";

// Admin: add Live Vote upgrades to an event for free (no charge, nothing recorded as a sale).
export default function CompUpgrades({
  eventId,
  proEnabled,
  superVotesEnabled,
  canAddTime,
  onGranted,
}: {
  eventId: string;
  proEnabled: boolean;
  superVotesEnabled: boolean;
  canAddTime: boolean;
  onGranted: (upgrade: "pro" | "super_votes" | "time") => void;
}) {
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(1);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function grant(upgrade: "pro" | "super_votes" | "time", label: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/comp-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, upgrade, days }),
      });
      const r = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok) setMsg({ ok: false, text: r.error ?? "Could not add the upgrade." });
      else {
        setMsg({ ok: true, text: `${label} added, free.` });
        onGranted(upgrade);
      }
    } catch {
      setMsg({ ok: false, text: "Network problem. Try again." });
    }
    setBusy(false);
  }

  const btn = "rounded-full border px-3 py-1 text-xs font-bold disabled:opacity-50";
  return (
    <div className="flex w-full flex-wrap items-center gap-1.5 border-t pt-2" style={{ borderColor: "var(--border)" }}>
      <span className="text-xs font-semibold" style={{ color: "var(--text-faint)" }}>Add free:</span>
      {proEnabled ? (
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>Pro ✓</span>
      ) : (
        <button type="button" disabled={busy} onClick={() => grant("pro", "Pro")} className={btn} style={{ borderColor: "var(--border)" }}>Pro</button>
      )}
      {superVotesEnabled ? (
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>Super Votes ✓</span>
      ) : (
        <button type="button" disabled={busy} onClick={() => grant("super_votes", "Super Votes")} className={btn} style={{ borderColor: "var(--border)" }}>Super Votes</button>
      )}
      {canAddTime && (
        <>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded border px-1.5 py-1 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface)" }} aria-label="Extra days">
            {[1, 2, 3, 5, 7, 14].map((d) => (
              <option key={d} value={d}>{d} day{d > 1 ? "s" : ""}</option>
            ))}
          </select>
          <button type="button" disabled={busy} onClick={() => grant("time", `${days} extra day${days > 1 ? "s" : ""}`)} className={btn} style={{ borderColor: "var(--border)" }}>Extra time</button>
        </>
      )}
      {msg && <span className="text-xs font-semibold" style={{ color: msg.ok ? "#22c55e" : "var(--danger)" }}>{msg.text}</span>}
    </div>
  );
}
