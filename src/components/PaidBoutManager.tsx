"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money, STATUS_LABEL, type PaidBoutStatus } from "@/lib/paidBouts";
import { safeHttpUrl } from "@/lib/safeUrl";

export type ManagerEntry = { id: string; username: string | null; entry_title: string | null; entry_url: string | null; status: string };
export type ManagerPrize = { id: string; place: number; amount_cents: number; winner_entry_id: string | null };
export type ManagerPayout = { id: string; seq: number; kind: string; place: number | null; amount_cents: number; status: string; method: string | null; recipient: string | null };
export type ManagerInvite = { email: string; status: string };

async function call(id: string, payload: Record<string, unknown>) {
  const res = await fetch(`/api/paid-bouts/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// The organizer's (and admin's) control room for one paid bout.
export default function PaidBoutManager({
  boutId,
  status,
  deadlinePassed,
  isAdmin,
  entries,
  prizes,
  payouts,
  invites,
}: {
  boutId: string;
  status: PaidBoutStatus;
  deadlinePassed: boolean;
  isAdmin: boolean;
  entries: ManagerEntry[];
  prizes: ManagerPrize[];
  payouts: ManagerPayout[];
  invites: ManagerInvite[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [emails, setEmails] = useState("");
  const [picks, setPicks] = useState<Record<number, string>>(
    Object.fromEntries(prizes.filter((p) => p.winner_entry_id).map((p) => [p.place, p.winner_entry_id as string]))
  );

  const paid = entries.filter((e) => e.status === "paid");

  async function run(payload: Record<string, unknown>, confirmText?: string, success?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const { ok, data } = await call(boutId, payload);
    setBusy(false);
    if (!ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    if (success) setNotice(success);
    router.refresh();
    return data;
  }

  async function sendInvites() {
    const list = emails.split(/[\s,;]+/).filter(Boolean);
    const data = await run({ action: "invite", emails: list });
    if (data) {
      setEmails("");
      const sent = (data.invites as { emailed: boolean }[]).filter((i) => i.emailed).length;
      const total = (data.invites as unknown[]).length;
      setNotice(
        data.emailConfigured
          ? `${sent} of ${total} invitations emailed.`
          : `Email sending isn't set up, so copy these private links and send them yourself:\n${(data.invites as { email: string; link: string }[]).map((i) => `${i.email}: ${i.link}`).join("\n")}`
      );
    }
  }

  const btn = "rounded border px-3 py-1.5 text-xs font-semibold disabled:opacity-50";
  const border = { borderColor: "var(--border)" };

  return (
    <section className="flex flex-col gap-5 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>Organizer controls</h2>
        <span className="rounded px-2 py-0.5 text-xs font-bold uppercase" style={{ background: "var(--surface-2)" }}>{STATUS_LABEL[status]}</span>
      </div>
      {error && <p className="rounded bg-red-100 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="whitespace-pre-wrap rounded p-3 text-sm" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>{notice}</p>}

      {status === "pending_review" && (
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>
          Waiting for a BoutCasts admin to review this bout. You can invite people now; entries open once it&apos;s approved.
        </p>
      )}

      {(status === "open" || status === "pending_review") && (
        <div>
          <h3 className="mb-1 text-sm font-semibold">Invite people</h3>
          <textarea
            className="min-h-[70px] w-full rounded border px-3 py-2 text-sm"
            style={border}
            placeholder="Email addresses, separated by commas or new lines"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
          />
          <button disabled={busy || !emails.trim()} onClick={sendInvites} className={`${btn} mt-2`} style={border}>
            Send invitations
          </button>
          {invites.length > 0 && (
            <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
              {invites.length} invited, {invites.filter((i) => i.status === "accepted").length} entered.
            </p>
          )}
        </div>
      )}

      <div>
        <h3 className="mb-1 text-sm font-semibold">Entries ({paid.length} paid)</h3>
        {entries.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>No entries yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{e.username ?? "Entrant"}</span>
                {e.entry_title && <span style={{ color: "var(--text-dim)" }}>{e.entry_title}</span>}
                {e.entry_url && (
                  <a href={safeHttpUrl(e.entry_url) ?? undefined} target="_blank" rel="noopener noreferrer" className="text-xs underline">view</a>
                )}
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: "var(--surface-2)" }}>{e.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {status === "open" && (
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy || (!isAdmin && !deadlinePassed)}
            onClick={() => run({ action: "close" }, "Close entries now? If the minimum wasn't reached, the bout is cancelled and everyone is refunded.", "Entries closed.")}
            className={btn}
            style={border}
            title={!isAdmin && !deadlinePassed ? "Entries stay open until the deadline" : undefined}
          >
            Close entries
          </button>
        </div>
      )}

      {status === "closed" && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Choose winners</h3>
          <div className="flex flex-col gap-2">
            {prizes.map((p) => (
              <label key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-40">Place {p.place} ({money(p.amount_cents)})</span>
                <select
                  className="rounded border px-2 py-1.5 text-sm"
                  style={border}
                  value={picks[p.place] ?? ""}
                  onChange={(e) => setPicks((cur) => ({ ...cur, [p.place]: e.target.value }))}
                >
                  <option value="">Select an entry</option>
                  {paid.map((e) => (
                    <option key={e.id} value={e.id}>{e.username ?? "Entrant"}{e.entry_title ? ` – ${e.entry_title}` : ""}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              disabled={busy || prizes.some((p) => !picks[p.place])}
              onClick={() => run({ action: "winners", winners: picks }, undefined, "Winners saved.")}
              className={btn}
              style={border}
            >
              Save winners
            </button>
            <button
              disabled={busy || prizes.some((p) => !p.winner_entry_id)}
              onClick={() => run({ action: "settle" }, "Lock the results and create the payout list? This can't be undone.", "Payout list created.")}
              className={btn}
              style={border}
              title={prizes.some((p) => !p.winner_entry_id) ? "Save winners first" : undefined}
            >
              Lock results and create payouts
            </button>
          </div>
        </div>
      )}

      {payouts.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold">Payouts, in the order they are paid</h3>
          <table className="w-full text-left text-sm">
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-t" style={border}>
                  <td className="py-1 pr-2">{p.seq}.</td>
                  <td className="py-1 pr-2">
                    {p.kind === "platform_fee" ? "BoutCasts fee" : p.kind === "prize" ? `Prize, place ${p.place}${p.recipient ? ` (${p.recipient})` : ""}` : "Organizer"}
                  </td>
                  <td className="py-1 pr-2 text-right font-semibold">{money(p.amount_cents)}</td>
                  <td className="py-1 text-right text-xs" style={{ color: p.status === "paid" ? "var(--gold)" : "var(--text-faint)" }}>
                    {p.status === "paid" ? `Paid${p.method ? ` (${p.method})` : ""}` : "Pending"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {["draft", "pending_review", "open", "closed"].includes(status) && (
        <div>
          <button
            disabled={busy}
            onClick={() => run({ action: "cancel", reason: "Cancelled by the organizer" }, "Cancel this bout and refund every entry fee in full?", "Bout cancelled and entries refunded.")}
            className={btn}
            style={{ borderColor: "#fca5a5", color: "#b91c1c" }}
          >
            Cancel bout and refund everyone
          </button>
        </div>
      )}
    </section>
  );
}
