"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CashRedemption } from "@/lib/types";

const GIFT_CARD_BRANDS = ["Amazon", "DoorDash", "Bose", "Visa"];

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function CashWalletCard({
  availableCents,
  pendingCents,
  lifetimeCents,
  redemptions,
}: {
  availableCents: number;
  pendingCents: number;
  lifetimeCents: number;
  redemptions: CashRedemption[];
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"cash" | "gift_card">("cash");
  const [amount, setAmount] = useState("");
  const [brand, setBrand] = useState(GIFT_CARD_BRANDS[0]);
  const [payoutMethod, setPayoutMethod] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState(redemptions);
  const [available, setAvailable] = useState(availableCents);

  async function handleSubmit() {
    setError(null);
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!amountCents || amountCents <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (amountCents > available) {
      setError("That's more than your available balance.");
      return;
    }
    if (mode === "cash" && !payoutMethod.trim()) {
      setError("Enter a PayPal email or payout method.");
      return;
    }
    setSubmitting(true);
    const { data, error: rpcError } = await supabase.rpc("request_cash_redemption", {
      p_redemption_type: mode,
      p_amount_cents: amountCents,
      p_gift_card_brand: mode === "gift_card" ? brand : null,
      p_payout_method: mode === "cash" ? payoutMethod.trim() : null,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setAvailable((a) => a - amountCents);
    setItems((prev) => [
      {
        id: data as string,
        user_id: "",
        redemption_type: mode,
        gift_card_brand: mode === "gift_card" ? brand : null,
        amount_cents: amountCents,
        payout_method: mode === "cash" ? payoutMethod.trim() : null,
        status: "pending",
        admin_note: null,
        created_at: new Date().toISOString(),
        fulfilled_at: null,
      },
      ...prev,
    ]);
    setAmount("");
    setPayoutMethod("");
    setOpen(false);
  }

  return (
    <div className="bc-card mb-6 overflow-hidden">
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <h2 className="text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Cash & gift card prizes
        </h2>
        <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
          Real-money winnings from bouts and challenges. Redeem for cash or a gift card.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-px" style={{ background: "var(--border)" }}>
        <div className="px-3 py-4 text-center" style={{ background: "var(--surface)" }}>
          <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
            Available
          </div>
          <div className="mt-1 text-lg font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--blue)" }}>
            {formatCents(available)}
          </div>
        </div>
        <div className="px-3 py-4 text-center" style={{ background: "var(--surface)" }}>
          <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
            Pending
          </div>
          <div className="mt-1 text-lg font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--text-dim)" }}>
            {formatCents(pendingCents)}
          </div>
        </div>
        <div className="px-3 py-4 text-center" style={{ background: "var(--surface)" }}>
          <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
            Lifetime
          </div>
          <div className="mt-1 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {formatCents(lifetimeCents)}
          </div>
        </div>
      </div>

      <div className="px-5 py-4">
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            disabled={available <= 0}
            className="w-full rounded-full px-4 py-2 text-sm font-bold"
            style={{
              background: available > 0 ? "var(--blue)" : "var(--surface-2)",
              color: available > 0 ? "#fff" : "var(--text-faint)",
            }}
          >
            {available > 0 ? "Redeem winnings" : "Nothing to redeem yet"}
          </button>
        ) : (
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
            <div className="mb-3 flex gap-2">
              <button
                onClick={() => setMode("cash")}
                className="flex-1 rounded-full px-3 py-1.5 text-xs font-bold"
                style={{
                  background: mode === "cash" ? "var(--blue)" : "var(--surface-2)",
                  color: mode === "cash" ? "#fff" : "var(--text-dim)",
                }}
              >
                Cash payout
              </button>
              <button
                onClick={() => setMode("gift_card")}
                className="flex-1 rounded-full px-3 py-1.5 text-xs font-bold"
                style={{
                  background: mode === "gift_card" ? "var(--blue)" : "var(--surface-2)",
                  color: mode === "gift_card" ? "#fff" : "var(--text-dim)",
                }}
              >
                Gift card
              </button>
            </div>

            <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
              Amount (USD)
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Up to ${formatCents(available)}`}
              className="mb-3 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)" }}
            />

            {mode === "gift_card" ? (
              <>
                <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                  Brand
                </label>
                <select
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="mb-3 w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)" }}
                >
                  {GIFT_CARD_BRANDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                  PayPal email (or other payout method)
                </label>
                <input
                  type="text"
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  placeholder="you@example.com"
                  className="mb-3 w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)" }}
                />
              </>
            )}

            {error && (
              <p className="mb-3 text-xs font-semibold" style={{ color: "var(--red)" }}>
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-full px-4 py-2 text-sm font-bold text-white"
                style={{ background: "var(--blue)" }}
              >
                {submitting ? "Submitting..." : "Request redemption"}
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
                className="rounded-full border px-4 py-2 text-sm font-semibold"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
            </div>
            <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
              Requests are reviewed and fulfilled by the BoutCasts team, usually within a few business days.
            </p>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <div className="px-5 py-2 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
            Redemption history
          </div>
          {items.map((r, i) => (
            <div
              key={r.id}
              className="flex items-center justify-between px-5 py-3"
              style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
            >
              <div>
                <div className="text-sm font-semibold">
                  {r.redemption_type === "gift_card" ? `${r.gift_card_brand} gift card` : "Cash payout"}
                </div>
                <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {new Date(r.created_at).toLocaleDateString()} ·{" "}
                  <span
                    style={{
                      color:
                        r.status === "fulfilled"
                          ? "var(--blue)"
                          : r.status === "rejected"
                          ? "var(--red)"
                          : "var(--gold)",
                    }}
                  >
                    {r.status}
                  </span>
                </div>
              </div>
              <span className="text-sm font-bold tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
                {formatCents(r.amount_cents)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
