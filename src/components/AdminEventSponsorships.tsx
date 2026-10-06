"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/eventSponsorships";

export type SponsorshipRow = {
  id: string; event_title: string; event_closed: boolean; organizer: string | null; company_name: string;
  gross_cents: number; platform_fee_cents: number; organizer_share_cents: number; status: string;
  organizer_payout_status: string; payout_method: string | null;
};

// Admin records the organizer's 70% payout (made outside the app) once the event has closed.
export default function AdminEventSponsorships({ rows }: { rows: SponsorshipRow[] }) {
  const supabase = createClient();
  const [method, setMethod] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState<Set<string>>(new Set());

  const live = rows.filter((r) => r.status === "approved");
  const owed = live.filter((r) => r.organizer_payout_status === "pending" && !paid.has(r.id));
  const kept = live.reduce((s, r) => s + r.platform_fee_cents, 0);

  async function markPaid(id: string) {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("mark_event_sponsorship_paid_out", { p_id: id, p_method: method[id] ?? "" });
    setBusy(false);
    if (e) setError(e.message);
    else setPaid((p) => new Set(p).add(id));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm">
        BoutCasts share on approved sponsorships: <strong>{money(kept)}</strong> · Owed to organizers:{" "}
        <strong>{money(owed.reduce((s, r) => s + r.organizer_share_cents, 0))}</strong>
      </p>
      {error && <p className="text-sm" style={{ color: "var(--red)" }}>{error}</p>}
      {rows.map((r) => {
        const done = r.organizer_payout_status === "paid" || paid.has(r.id);
        return (
          <div key={r.id} className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)" }}>
            <p>
              <strong>{r.company_name}</strong> → {r.event_title} ({r.organizer ?? "organizer"}) · {money(r.gross_cents)} · fee {money(r.platform_fee_cents)} · organizer {money(r.organizer_share_cents)} · {r.status}
            </p>
            {r.status === "approved" &&
              (done ? (
                <p style={{ color: "var(--text-dim)" }}>Paid out{r.payout_method ? ` via ${r.payout_method}` : ""}.</p>
              ) : r.event_closed ? (
                <div className="mt-2 flex gap-2">
                  <input className="rounded border px-2 py-1" style={{ borderColor: "var(--border)", background: "var(--surface)" }} placeholder="How paid (Zelle, ACH, check)" value={method[r.id] ?? ""} onChange={(e) => setMethod((m) => ({ ...m, [r.id]: e.target.value }))} />
                  <button type="button" disabled={busy} className="font-semibold underline" onClick={() => markPaid(r.id)}>Mark paid</button>
                </div>
              ) : (
                <p style={{ color: "var(--text-dim)" }}>Payable after the event closes.</p>
              ))}
          </div>
        );
      })}
      {rows.length === 0 && <p className="text-sm" style={{ color: "var(--text-dim)" }}>No organizer-sold sponsorships yet.</p>}
    </div>
  );
}
