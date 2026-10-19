"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SUPER_VOTES } from "@/lib/liveVoteEvents/tiers";

// Organizer panel: unlock Super Votes (paid), choose whether they count
// toward the winner, and see earnings (organizer's share of fan purchases).

type Earnings = { purchases: number; super_votes: number; gross_cents: number; organizer_share_cents: number };

export default function SuperVotesManager({
  eventId,
  status,
  enabled,
  platinumCents,
  eligible,
  isAdmin,
  onChanged,
}: {
  eventId: string;
  status: "draft" | "live" | "closed";
  enabled: boolean;
  platinumCents: number | null;
  /** Always "separate" now; kept so callers don't need to change. */
  mode: "separate" | "counted";
  eligible: boolean;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platInput, setPlatInput] = useState(platinumCents != null ? String(platinumCents / 100) : "");

  const load = useCallback(async () => {
    if (!enabled) return;
    const { data } = await supabase.rpc("get_super_vote_earnings", { p_event_id: eventId });
    setEarnings(data as Earnings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, enabled]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function unlock() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/super-votes-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't start checkout.");
      window.location.assign(data.url);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Couldn't start checkout.");
    }
  }

  async function rpc(fn: string, args: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc(fn, args);
    setBusy(false);
    if (rpcError) setError(rpcError.message);
    onChanged();
  }

  const box = { borderColor: "var(--border)", background: "var(--surface)" };
  const money = (c: number) => `$${(c / 100).toFixed(2)}`;

  if (!eligible && !enabled) return null;

  return (
    <div className="mb-4 rounded-xl border p-3.5" style={box}>
      <p className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
        ⚡ Super Votes {enabled && "· On"}
      </p>

      {!enabled ? (
        <>
          <p className="mb-2 text-sm" style={{ color: "var(--text-dim)" }}>
            Let fans buy Super Vote packs (10 for $0.99, 50 for $3.99, 150 for $9.99) to boost their
            favorite. Add a Platinum Supporter tier too. You keep {Math.round(SUPER_VOTES.organizerShare * 100)}% of final collections,
            less any applicable fees, and contestants share their links to rally fans. Regular voting stays free.
          </p>
          {status !== "closed" && (
            <div className="flex flex-col gap-2">
              <button onClick={unlock} disabled={busy} className="bc-btn-solid rounded-full px-4 py-2.5 text-sm font-bold disabled:opacity-60">
                {busy ? "Starting checkout…" : `Turn on Super Votes — $${SUPER_VOTES.unlockCents / 100}`}
              </button>
              {isAdmin && (
                <button
                  onClick={() => rpc("admin_enable_super_votes", { p_event_id: eventId })}
                  disabled={busy}
                  className="rounded-full border px-4 py-2 text-xs font-semibold"
                  style={{ borderColor: "var(--border)" }}
                >
                  Turn on free (admin)
                </button>
              )}
            </div>
          )}
          <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
            Not recommended for school elections or events where most voters are under 18.
          </p>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm" style={{ color: "var(--text-dim)" }}>
            Super Votes show as a separate <strong>Fan Boost</strong> total next to each contestant. They
            don&apos;t decide the winner. Regular votes do.
          </p>
          {earnings && (
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Super Votes", earnings.super_votes.toLocaleString()],
                ["Fan sales", money(earnings.gross_cents)],
                ["Your share", money(earnings.organizer_share_cents)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg p-2" style={{ background: "var(--surface-2)" }}>
                  <p className="text-base font-bold">{v}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                    {k}
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 rounded-lg border p-2.5" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-bold" style={{ color: "var(--text-dim)" }}>
              ★ Platinum Supporter price
            </p>
            <p className="mb-2 text-xs" style={{ color: "var(--text-faint)" }}>
              Set a price, or leave it blank so fans can give any amount of ${SUPER_VOTES.platinumMinCents / 100} or more.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">$</span>
              <input
                type="number"
                min={SUPER_VOTES.platinumMinCents / 100}
                step={1}
                value={platInput}
                onChange={(e) => setPlatInput(e.target.value)}
                placeholder="Open amount"
                aria-label="Platinum Supporter price in dollars"
                className="w-32 rounded-lg border px-2 py-1.5 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              />
              <button
                disabled={busy || status === "closed"}
                onClick={() => rpc("set_super_votes_platinum", { p_event_id: eventId, p_cents: platInput.trim() === "" ? null : Math.round(Number(platInput)) * 100 })}
                className="rounded-full border px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                style={{ borderColor: "var(--border)" }}
              >
                Save
              </button>
            </div>
          </div>
          <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
            Your share is paid out after the event closes — email support@boutcasts.com with your payout details.
          </p>
        </>
      )}
      {error && (
        <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
