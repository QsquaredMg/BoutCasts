"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Removes a hand-recorded entry (e.g. one made by mistake). Two steps so it can't be done by accident.
export default function VoidSaleButton({ id, what }: { id: string; what: string }) {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    let r: { ok?: boolean; error?: string };
    try {
      const res = await fetch("/api/admin/manual-sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "void", id }) });
      r = await res.json();
    } catch {
      r = { error: "Network problem. Try again." };
    }
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Could not remove.");
    router.refresh();
  }

  if (!sure) {
    return (
      <button type="button" onClick={() => setSure(true)} className="rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: "var(--border)", color: "var(--red)" }}>
        Remove entry
      </button>
    );
  }
  return (
    <div role="group" aria-label={`Remove ${what}`} className="flex flex-col gap-2 text-xs">
      <p className="font-semibold">Remove this entry from the list and totals? No money moves.</p>
      <div className="flex gap-2">
        <button type="button" onClick={remove} disabled={busy} className="bc-btn-red rounded-full px-3 py-1 font-bold disabled:opacity-60">{busy ? "Removing…" : "Yes, remove"}</button>
        <button type="button" onClick={() => setSure(false)} disabled={busy} className="rounded-full border px-3 py-1 font-bold" style={{ borderColor: "var(--border)" }}>Keep</button>
      </div>
      {error && <p role="alert" className="font-semibold" style={{ color: "var(--red)" }}>{error}</p>}
    </div>
  );
}
