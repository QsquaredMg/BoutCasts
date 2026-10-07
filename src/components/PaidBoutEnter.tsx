"use client";

import { useState } from "react";
import Link from "next/link";
import { money } from "@/lib/paidBouts";

export default function PaidBoutEnter({
  boutId,
  feeCents,
  signedIn,
  inviteToken,
  inviteOnly,
}: {
  boutId: string;
  feeCents: number;
  signedIn: boolean;
  inviteToken: string | null;
  inviteOnly: boolean;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <p className="rounded-lg p-4 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
        <Link href={`/login?next=/paid-bouts/${boutId}${inviteToken ? `?invite=${inviteToken}` : ""}`} className="font-semibold underline">
          Sign in
        </Link>{" "}
        to enter.
      </p>
    );
  }

  if (inviteOnly && !inviteToken) {
    return (
      <p className="rounded-lg p-4 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
        This bout is invite-only. Open the link from your invitation email to enter.
      </p>
    );
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/checkout/paid-bout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boutId, entryTitle: title, entryUrl: url, rulesAccepted: ok, inviteToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      setBusy(false);
      setError(data.error ?? "Couldn't start checkout.");
      return;
    }
    window.location.href = data.url;
  }

  const field = "rounded border px-3 py-2 text-sm";
  return (
    <form onSubmit={pay} className="flex flex-col gap-3 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <h3 className="text-base font-bold" style={{ fontFamily: "var(--font-display)" }}>Enter this bout</h3>
      {error && <p className="rounded bg-red-100 p-3 text-sm text-red-700">{error}</p>}
      <input className={field} style={{ borderColor: "var(--border)" }} maxLength={120} placeholder="Name your entry (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className={field} style={{ borderColor: "var(--border)" }} type="url" placeholder="Link to your entry, https://… (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>I've read the rules and the payout terms, and I understand the entry fee is refunded only if the bout is cancelled.</span>
      </label>
      <button type="submit" disabled={busy || !ok} className="self-start rounded px-5 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--red)" }}>
        {busy ? "Opening checkout…" : `Pay ${money(feeCents)} and enter`}
      </button>
    </form>
  );
}
