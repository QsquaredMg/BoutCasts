"use client";

import { useState } from "react";
import { TIME_ADDON } from "@/lib/liveVoteEvents/tiers";

// Organizer control on a live event: buy extra days of voting.
export default function TimeAddOn({ eventId }: { eventId: string }) {
  const [days, setDays] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/time-addon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, days }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't start checkout.");
      window.location.assign(data.url);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Couldn't start checkout.");
    }
  }

  const total = (days * TIME_ADDON.centsPerDay) / 100;
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
      <p className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
        Need more time?
      </p>
      <p className="mb-2 text-sm" style={{ color: "var(--text-dim)" }}>
        Add days to this vote for ${TIME_ADDON.centsPerDay / 100} per day.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-[10px] border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          aria-label="Days to add"
        >
          {Array.from({ length: TIME_ADDON.maxDays }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d} day{d === 1 ? "" : "s"}
            </option>
          ))}
        </select>
        <button onClick={buy} disabled={busy} className="bc-btn-solid rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60">
          {busy ? "Starting checkout…" : `Add time — $${total}`}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
