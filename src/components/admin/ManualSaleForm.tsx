"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const METHODS = ["Cash", "Check", "Venmo", "Zelle", "Cash App", "PayPal", "Invoice", "Other"];
const SUGGESTIONS = ["Live Vote event", "Live Vote Pro upgrade", "School election", "Prediction game", "Paid bout entry", "Sponsorship", "School & League License", "Organizer Pro"];

// Record a sale taken outside Stripe, or a free grant, so it shows in Purchases and the weekly total.
// This only keeps the record: turn the item itself on from its own Admin page.
export default function ManualSaleForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"offline" | "comp">("offline");
  const [what, setWhat] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [soldOn, setSoldOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Same for every try of this entry, so a double-click or a retry saves it once.
  const clientId = useRef(crypto.randomUUID());

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(Number(amount) * 100);
    if (kind === "offline" && (!Number.isFinite(cents) || cents < 1)) return setError("Enter the amount you received.");
    setBusy(true);
    setError(null);
    let r: { ok?: boolean; error?: string };
    try {
      const res = await fetch("/api/admin/manual-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: clientId.current, kind, what, amountCents: cents, method, buyerName: name, buyerEmail: email, note, soldOn: soldOn || undefined }),
      });
      r = await res.json();
    } catch {
      r = { error: "Network problem. Check the list below before trying again." };
    }
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Could not save.");
    clientId.current = crypto.randomUUID();
    setWhat(""); setAmount(""); setName(""); setEmail(""); setNote(""); setSoldOn("");
    setOpen(false);
    router.refresh();
  }

  const field = "w-full rounded-lg border bg-transparent px-3 py-2 text-sm";
  const border = { borderColor: "var(--border)" } as const;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mb-4 rounded-full border px-4 py-2 text-sm font-bold" style={border}>
        + Record a sale or free grant
      </button>
    );
  }
  return (
    <form onSubmit={save} className="bc-card mb-4 grid gap-3 p-4">
      <h3 className="text-base font-bold">Record a sale or free grant</h3>
      <p className="text-xs" style={{ color: "var(--text-faint)" }}>
        This keeps the record and adds it to the totals. It doesn&apos;t switch anything on: use the item&apos;s own Admin page for that (Live Vote events and school elections have a free go-live button there).
      </p>
      <div className="flex flex-wrap gap-4 text-sm font-semibold" role="radiogroup" aria-label="Type">
        <label className="flex items-center gap-2"><input type="radio" name="kind" checked={kind === "offline"} onChange={() => setKind("offline")} /> Sale paid another way</label>
        <label className="flex items-center gap-2"><input type="radio" name="kind" checked={kind === "comp"} onChange={() => setKind("comp")} /> Free grant (no charge)</label>
      </div>
      <label className="grid gap-1 text-xs font-bold">What was it?
        <input list="manual-sale-suggestions" required maxLength={120} value={what} onChange={(e) => setWhat(e.target.value)} className={field} style={border} placeholder="e.g. Live Vote event, Medium tier" />
        <datalist id="manual-sale-suggestions">{SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
      </label>
      {kind === "offline" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold">Amount received ($)
            <input type="number" inputMode="decimal" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className={field} style={border} />
          </label>
          <label className="grid gap-1 text-xs font-bold">How they paid
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={field} style={border}>
              {METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold">Buyer name
          <input maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={field} style={border} />
        </label>
        <label className="grid gap-1 text-xs font-bold">Buyer email
          <input type="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} className={field} style={border} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold">Date (leave blank for today)
          <input type="date" value={soldOn} onChange={(e) => setSoldOn(e.target.value)} className={field} style={border} />
        </label>
        <label className="grid gap-1 text-xs font-bold">Note (why, check number, etc.)
          <input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={field} style={border} />
        </label>
      </div>
      {error && <p role="alert" className="text-sm font-semibold" style={{ color: "var(--red)" }}>{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="bc-btn-solid rounded-full px-5 py-2 text-sm font-bold disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => setOpen(false)} disabled={busy} className="rounded-full border px-4 py-2 text-sm font-bold" style={border}>Cancel</button>
      </div>
    </form>
  );
}
