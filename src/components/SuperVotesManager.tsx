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
  mode,
  eligible,
  isAdmin,
  onChanged,
}: {
  eventId: string;
  status: "draft" | "live" | "closed";
  enabled: boolean;
  mode: "separate" | "counted";
  eligible: boolean;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const locked = (earnings?.purchases ?? 0) > 0;

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
            favorite. You earn {Math.round(SUPER_VOTES.organizerShare * 100)}% of every sale, and
            contestants share their links to rally fans. Regular voting stays free.
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
          <div className="mb-3 flex flex-col gap-1.5 text-sm">
            {(
              [
                ["separate", "Separate Fan Boost total (recommended)", "Super Votes show next to each contestant but don't decide the winner."],
                ["counted", "Count toward the winner", "Super Votes are added to the main tally. Paid votes deciding a prize can be regulated where you are — check local rules."],
              ] as const
            ).map(([value, label, hint]) => (
              <label key={value} className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="radio"
                  name="sv-mode"
                  className="mt-1 accent-[var(--red)]"
                  checked={mode === value}
                  disabled={busy || locked || status === "closed"}
                  onChange={() => rpc("set_live_vote_super_votes_mode", { p_event_id: eventId, p_mode: value })}
                />
                <span>
                  <span className="font-semibold">{label}</span>
                  <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
                    {hint}
                  </span>
                </span>
              </label>
            ))}
            {locked && (
              <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                Locked after the first purchase so the rules don&apos;t change mid-vote.
              </p>
            )}
          </div>
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
