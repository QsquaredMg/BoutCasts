"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CashRedemption, CashWalletEvent } from "@/lib/types";

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function CashPrizeAdmin({
  initialPendingEvents,
  initialPendingRedemptions,
}: {
  initialPendingEvents: (CashWalletEvent & { profiles?: { username: string | null } | null })[];
  initialPendingRedemptions: CashRedemption[];
}) {
  const supabase = createClient();

  // Award form
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [awarding, setAwarding] = useState(false);
  const [awardError, setAwardError] = useState<string | null>(null);
  const [awardSuccess, setAwardSuccess] = useState<string | null>(null);

  const [pendingEvents, setPendingEvents] = useState(initialPendingEvents);
  const [pendingRedemptions, setPendingRedemptions] = useState(initialPendingRedemptions);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleAward() {
    setAwardError(null);
    setAwardSuccess(null);
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!username.trim()) {
      setAwardError("Enter a username.");
      return;
    }
    if (!amountCents || amountCents <= 0) {
      setAwardError("Enter a valid amount.");
      return;
    }
    if (!reason.trim()) {
      setAwardError("Enter a reason.");
      return;
    }
    setAwarding(true);
    const { data: profile, error: lookupError } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", username.trim())
      .maybeSingle();
    if (lookupError || !profile) {
      setAwarding(false);
      setAwardError("No user found with that username.");
      return;
    }
    const { error: rpcError } = await supabase.rpc("award_cash_prize", {
      p_user_id: profile.id,
      p_amount_cents: amountCents,
      p_reason: reason.trim(),
    });
    setAwarding(false);
    if (rpcError) {
      setAwardError(rpcError.message);
      return;
    }
    setAwardSuccess(`Awarded ${formatCents(amountCents)} (pending) to ${profile.username}.`);
    setPendingEvents((prev) => [
      {
        id: crypto.randomUUID(),
        user_id: profile.id,
        amount_cents: amountCents,
        reason: reason.trim(),
        status: "pending",
        related_bout_id: null,
        created_at: new Date().toISOString(),
        released_at: null,
        profiles: { username: profile.username },
      },
      ...prev,
    ]);
    setUsername("");
    setAmount("");
    setReason("");
  }

  async function handleRelease(eventId: string) {
    setBusyId(eventId);
    const { error } = await supabase.rpc("release_pending_cash", { p_event_id: eventId });
    setBusyId(null);
    if (error) {
      alert(error.message);
      return;
    }
    setPendingEvents((prev) => prev.filter((e) => e.id !== eventId));
  }

  async function handleResolveRedemption(id: string, approve: boolean) {
    const note = approve
      ? null
      : window.prompt("Reason for rejecting (refunds the amount to the user)?") ?? "";
    setBusyId(id);
    const { error } = await supabase.rpc("admin_resolve_redemption", {
      p_redemption_id: id,
      p_approve: approve,
      p_admin_note: note,
    });
    setBusyId(null);
    if (error) {
      alert(error.message);
      return;
    }
    setPendingRedemptions((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bc-card p-5">
        <h2 className="mb-1 text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Award a cash prize
        </h2>
        <p className="mb-4 text-xs" style={{ color: "var(--text-faint)" }}>
          Lands in the user&apos;s pending balance. Release it once confirmed to make it redeemable.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="rounded-lg border px-3 py-2 text-sm sm:w-40"
            style={{ borderColor: "var(--border)" }}
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Amount (USD)"
            className="rounded-lg border px-3 py-2 text-sm sm:w-32"
            style={{ borderColor: "var(--border)" }}
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (e.g. Iron Mic Series champion)"
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)" }}
          />
          <button
            onClick={handleAward}
            disabled={awarding}
            className="rounded-full px-4 py-2 text-sm font-bold text-white"
            style={{ background: "var(--blue)" }}
          >
            {awarding ? "Awarding..." : "Award"}
          </button>
        </div>
        {awardError && (
          <p className="mt-2 text-xs font-semibold" style={{ color: "var(--red)" }}>
            {awardError}
          </p>
        )}
        {awardSuccess && (
          <p className="mt-2 text-xs font-semibold" style={{ color: "var(--blue)" }}>
            {awardSuccess}
          </p>
        )}
      </div>

      <div className="bc-card overflow-hidden">
        <div className="px-5 py-3 text-sm font-bold" style={{ borderBottom: "1px solid var(--border)", fontFamily: "var(--font-display)" }}>
          Pending prizes ({pendingEvents.length})
        </div>
        {pendingEvents.length === 0 ? (
          <p className="p-5 text-sm" style={{ color: "var(--text-faint)" }}>
            Nothing pending release.
          </p>
        ) : (
          pendingEvents.map((e, i) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-3 px-5 py-3"
              style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
            >
              <div>
                <div className="text-sm font-semibold">
                  {e.profiles?.username ?? "unknown"} — {e.reason}
                </div>
                <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {formatCents(e.amount_cents)} · {new Date(e.created_at).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => handleRelease(e.id)}
                disabled={busyId === e.id}
                className="rounded-full px-3 py-1.5 text-xs font-bold text-white"
                style={{ background: "var(--blue)" }}
              >
                Release
              </button>
            </div>
          ))
        )}
      </div>

      <div className="bc-card overflow-hidden">
        <div className="px-5 py-3 text-sm font-bold" style={{ borderBottom: "1px solid var(--border)", fontFamily: "var(--font-display)" }}>
          Pending redemption requests ({pendingRedemptions.length})
        </div>
        {pendingRedemptions.length === 0 ? (
          <p className="p-5 text-sm" style={{ color: "var(--text-faint)" }}>
            No pending redemption requests.
          </p>
        ) : (
          pendingRedemptions.map((r, i) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 px-5 py-3"
              style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
            >
              <div>
                <div className="text-sm font-semibold">
                  {r.profiles?.username ?? "unknown"} —{" "}
                  {r.redemption_type === "gift_card" ? `${r.gift_card_brand} gift card` : `Cash (${r.payout_method})`}
                </div>
                <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {formatCents(r.amount_cents)} · {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleResolveRedemption(r.id, true)}
                  disabled={busyId === r.id}
                  className="rounded-full px-3 py-1.5 text-xs font-bold text-white"
                  style={{ background: "var(--blue)" }}
                >
                  Fulfill
                </button>
                <button
                  onClick={() => handleResolveRedemption(r.id, false)}
                  disabled={busyId === r.id}
                  className="rounded-full border px-3 py-1.5 text-xs font-bold"
                  style={{ borderColor: "var(--red)", color: "var(--red)" }}
                >
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
