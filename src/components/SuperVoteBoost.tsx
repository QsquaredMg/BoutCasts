"use client";

import { useState } from "react";
import { SUPER_VOTES } from "@/lib/liveVoteEvents/tiers";

// Per-contestant "⚡ Boost" control: shows the Super Vote count and lets a fan
// buy a pack through Stripe Checkout.
export default function SuperVoteBoost({
  eventId,
  optionId,
  optionName,
  count,
  canBuy,
  platinumCents = null,
}: {
  eventId: string;
  optionId: string;
  optionName: string;
  count: number;
  canBuy: boolean;
  /** Organizer-set Platinum Supporter price in cents; null = the fan picks any amount of $20 or more. */
  platinumCents?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [platDollars, setPlatDollars] = useState(String(SUPER_VOTES.platinumMinCents / 100));

  async function buy(pack: string, amountCents?: number) {
    setBusy(pack);
    setError(null);
    try {
      const res = await fetch("/api/checkout/super-votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, optionId, pack, amountCents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't start checkout.");
      window.location.assign(data.url);
    } catch (err) {
      setBusy(null);
      setError(err instanceof Error ? err.message : "Couldn't start checkout.");
    }
  }

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold" style={{ color: "var(--gold, #a97a12)" }}>
          ⚡ {count.toLocaleString()} Super Vote{count === 1 ? "" : "s"}
        </span>
        {canBuy && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-full border px-3 py-1 text-xs font-bold"
            style={{ borderColor: "var(--gold, #a97a12)", color: "var(--gold, #a97a12)" }}
            aria-expanded={open}
          >
            ⚡ Boost
          </button>
        )}
      </div>
      {open && canBuy && (
        <div className="mt-2 rounded-lg p-2.5" style={{ background: "var(--surface-2)" }}>
          <p className="mb-2 text-xs" style={{ color: "var(--text-dim)" }}>
            Boost <b>{optionName}</b> with Super Votes:
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {SUPER_VOTES.packs.map((p) => (
              <button
                key={p.key}
                type="button"
                disabled={busy !== null}
                onClick={() => buy(p.key)}
                className="rounded-lg border px-2 py-2 text-center disabled:opacity-60"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <span className="block text-sm font-bold">⚡ {p.quantity}</span>
                <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
                  {busy === p.key ? "…" : `$${(p.cents / 100).toFixed(2)}`}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-2 rounded-lg border p-2" style={{ borderColor: "var(--gold, #a97a12)", background: "var(--surface)" }}>
            <p className="text-xs font-bold" style={{ color: "var(--gold, #a97a12)" }}>
              ★ Platinum Supporter
            </p>
            {platinumCents != null ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => buy("platinum")}
                className="mt-1.5 w-full rounded-lg border px-2 py-2 text-sm font-bold disabled:opacity-60"
                style={{ borderColor: "var(--border)" }}
              >
                {busy === "platinum" ? "…" : `Give $${(platinumCents / 100).toFixed(2)}`}
              </button>
            ) : (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-sm font-bold">$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={SUPER_VOTES.platinumMinCents / 100}
                  step={1}
                  value={platDollars}
                  onChange={(e) => setPlatDollars(e.target.value)}
                  aria-label="Platinum Supporter amount in dollars"
                  className="w-20 rounded-lg border px-2 py-1.5 text-sm"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                />
                <button
                  type="button"
                  disabled={busy !== null || !(Number(platDollars) >= SUPER_VOTES.platinumMinCents / 100)}
                  onClick={() => buy("platinum", Math.round(Number(platDollars)) * 100)}
                  className="flex-1 rounded-lg border px-2 py-1.5 text-sm font-bold disabled:opacity-60"
                  style={{ borderColor: "var(--border)" }}
                >
                  {busy === "platinum" ? "…" : "Give"}
                </button>
              </div>
            )}
            <p className="mt-1 text-[11px]" style={{ color: "var(--text-faint)" }}>
              {platinumCents != null ? "The top tier." : `Any amount of $${SUPER_VOTES.platinumMinCents / 100} or more.`}
            </p>
          </div>
          <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
            Secure checkout by Stripe. Must be 18+ or have a parent&apos;s permission. Purchases are final.
          </p>
          {error && (
            <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
