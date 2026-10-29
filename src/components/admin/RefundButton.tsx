"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Two-step refund: press Refund, check the amount, then confirm. Full by default, or a smaller amount.
export default function RefundButton({ paymentIntentId, remainingCents, buyer, what }: { paymentIntentId: string; remainingCents: number; buyer: string; what: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState((remainingCents / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  // Stays the same across retries of this refund so a lost response cannot cause a second refund.
  const attemptId = useRef(crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0 || cents > remainingCents) {
      return setError(`Enter an amount up to $${(remainingCents / 100).toFixed(2)}.`);
    }
    setBusy(true);
    setError(null);
    let r: { ok?: boolean; error?: string };
    try {
      const res = await fetch("/api/admin/refunds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentIntentId, amountCents: cents, attemptId: attemptId.current }) });
      r = await res.json();
    } catch {
      r = { error: "Network problem. Check Stripe before trying again." };
    }
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Could not refund.");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: "var(--border)", color: "var(--red)" }}>
        Refund
      </button>
    );
  }
  return (
    <div role="group" aria-label={`Refund ${what}`} className="flex flex-col gap-2 rounded-xl border p-3 text-left text-xs" style={{ borderColor: "var(--red)" }}>
      <p className="font-semibold">Refund {buyer} for {what}? This sends the money back through Stripe and can&apos;t be undone.</p>
      <label className="flex items-center gap-2 font-semibold">
        Amount $
        <input type="number" step="0.01" min="0.01" max={(remainingCents / 100).toFixed(2)} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-24 rounded-lg border bg-transparent px-2 py-1" style={{ borderColor: "var(--border)" }} />
      </label>
      <p style={{ color: "var(--text-faint)" }}>The buyer keeps what they got. Archive or delete the item from its Admin page if it should go too.</p>
      <div className="flex gap-2">
        <button type="button" onClick={confirm} disabled={busy} className="bc-btn-red rounded-full px-3 py-1 font-bold disabled:opacity-60">{busy ? "Refunding…" : "Confirm refund"}</button>
        <button type="button" onClick={() => setOpen(false)} disabled={busy} className="rounded-full border px-3 py-1 font-bold" style={{ borderColor: "var(--border)" }}>Cancel</button>
      </div>
      {error && <p role="alert" className="font-semibold" style={{ color: "var(--red)" }}>{error}</p>}
    </div>
  );
}
