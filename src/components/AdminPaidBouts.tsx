"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { money, STATUS_LABEL, type PaidBoutStatus } from "@/lib/paidBouts";

export type AdminBout = {
  id: string;
  title: string;
  status: PaidBoutStatus;
  organizer: string | null;
  entry_fee_cents: number;
  min_entries: number;
  entry_deadline: string;
  prize_total: number;
  paid_entries: number;
  review_note: string | null;
  payouts: { id: string; seq: number; kind: string; place: number | null; amount_cents: number; status: string; method: string | null; recipient: string | null }[];
};

async function call(id: string, payload: Record<string, unknown>) {
  const res = await fetch(`/api/paid-bouts/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export default function AdminPaidBouts({ bouts }: { bouts: AdminBout[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});

  async function run(key: string, id: string, payload: Record<string, unknown>) {
    setBusy(key);
    setError(null);
    const { ok, data } = await call(id, payload);
    setBusy(null);
    if (!ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  const review = bouts.filter((b) => b.status === "pending_review");
  const paying = bouts.filter((b) => b.status === "settling");
  const rest = bouts.filter((b) => !["pending_review", "settling"].includes(b.status));
  const border = { borderColor: "var(--border)" };
  const btn = "rounded border px-3 py-1.5 text-xs font-semibold disabled:opacity-50";

  return (
    <div className="flex flex-col gap-8">
      {error && <p className="rounded bg-red-100 p-3 text-sm text-red-700">{error}</p>}

      <section>
        <h3 className="mb-3 text-lg font-semibold">Waiting for review ({review.length})</h3>
        {review.length === 0 ? <p className="text-sm" style={{ color: "var(--text-faint)" }}>Nothing to review.</p> : (
          <ul className="flex flex-col gap-3">
            {review.map((b) => (
              <li key={b.id} className="rounded-lg border p-3" style={border}>
                <Link href={`/paid-bouts/${b.id}`} className="font-semibold underline">{b.title}</Link>
                <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
                  By {b.organizer ?? "unknown"} · {money(b.entry_fee_cents)} entry · {money(b.prize_total)} prizes · min {b.min_entries} entries.
                  Read the rules and judging on the bout page before approving.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button disabled={busy !== null} onClick={() => run(`a${b.id}`, b.id, { action: "approve" })} className={btn} style={{ borderColor: "#86efac", color: "#15803d" }}>Approve</button>
                  <input className="min-w-[180px] flex-1 rounded border px-2 py-1.5 text-xs" style={border} placeholder="Reason, if rejecting" value={note[b.id] ?? ""} onChange={(e) => setNote((c) => ({ ...c, [b.id]: e.target.value }))} />
                  <button disabled={busy !== null || !(note[b.id] ?? "").trim()} onClick={() => run(`r${b.id}`, b.id, { action: "reject", note: note[b.id] })} className={btn} style={border}>Reject</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold">Payouts to send ({paying.length})</h3>
        <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
          Send each prize first, then the organizer. The organizer&apos;s payout can only be marked paid once the fee and every prize are paid.
          Record how you sent each one (Zelle, ACH, check).
        </p>
        {paying.length === 0 ? <p className="text-sm" style={{ color: "var(--text-faint)" }}>No payouts waiting.</p> : (
          <ul className="flex flex-col gap-4">
            {paying.map((b) => (
              <li key={b.id} className="rounded-lg border p-3" style={border}>
                <Link href={`/paid-bouts/${b.id}`} className="font-semibold underline">{b.title}</Link>
                <table className="mt-2 w-full text-left text-sm">
                  <tbody>
                    {b.payouts.map((p) => (
                      <tr key={p.id} className="border-t" style={border}>
                        <td className="py-1.5 pr-2">{p.seq}.</td>
                        <td className="py-1.5 pr-2">
                          {p.kind === "platform_fee" ? "BoutCasts fee" : p.kind === "prize" ? `Prize, place ${p.place}: ${p.recipient ?? "winner"}` : `Organizer: ${b.organizer ?? ""}`}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-semibold">{money(p.amount_cents)}</td>
                        <td className="py-1.5 text-right">
                          {p.status === "paid" ? (
                            <span className="text-xs" style={{ color: "var(--gold)" }}>Paid{p.method ? ` (${p.method})` : ""}</span>
                          ) : (
                            <span className="flex items-center justify-end gap-1">
                              <input className="w-24 rounded border px-2 py-1 text-xs" style={border} placeholder="Zelle…" value={method[p.id] ?? ""} onChange={(e) => setMethod((c) => ({ ...c, [p.id]: e.target.value }))} />
                              <button disabled={busy !== null || !(method[p.id] ?? "").trim()} onClick={() => run(`p${p.id}`, b.id, { action: "markPaid", payoutId: p.id, method: method[p.id] })} className={btn} style={border}>Mark paid</button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold">All other paid bouts</h3>
        {rest.length === 0 ? <p className="text-sm" style={{ color: "var(--text-faint)" }}>None yet.</p> : (
          <ul className="flex flex-col gap-2 text-sm">
            {rest.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2" style={border}>
                <Link href={`/paid-bouts/${b.id}`} className="font-semibold underline">{b.title}</Link>
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: "var(--surface-2)" }}>{STATUS_LABEL[b.status]}</span>
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {b.paid_entries} of {b.min_entries} min entered · closes {new Date(b.entry_deadline).toLocaleDateString("en-US")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
