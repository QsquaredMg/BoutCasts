"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";

const PERKS = [
  "Ad-free browsing across every bracket and feed",
  "Early access to new brackets before they go public",
  "A Pro badge next to your name on profiles and the leaderboard",
  "Priority moderation review on your submissions",
];

export default function ProMembershipCard({ isPro }: { isPro: boolean }) {
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  async function upgrade() {
    setBusy(true);
    try {
      const res = await fetch("/api/checkout/pro", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Couldn't start checkout.");
      window.location.href = data.url;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      setBusy(false);
    }
  }

  async function cancel() {
    if (!confirm("Cancel your BoutCasts Pro membership? You'll keep access until the current billing period ends.")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/checkout/pro/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't cancel membership.");
      showToast("Membership cancelled", "info");
      window.location.reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Something went wrong.", "error");
      setBusy(false);
    }
  }

  return (
    <div
      className="mb-6 rounded-2xl border p-5"
      style={{
        borderColor: "rgba(169,122,18,0.3)",
        background: "linear-gradient(155deg, var(--gold-soft), var(--surface) 65%)",
      }}
    >
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold" style={{ fontFamily: "var(--font-display)" }}>
          BoutCasts Pro
        </h2>
        {isPro ? (
          <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: "var(--gold)", color: "#2a1c00" }}>
            Active
          </span>
        ) : (
          <span className="font-bold" style={{ fontFamily: "var(--font-display)", color: "#8a5a00" }}>
            $4.99<small className="ml-0.5 text-xs font-semibold" style={{ color: "var(--text-faint)" }}>/mo</small>
          </span>
        )}
      </div>

      <ul className="my-3 flex flex-col gap-1.5">
        {PERKS.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-dim)" }}>
            <span className="flex-shrink-0">⭐</span>
            {p}
          </li>
        ))}
      </ul>

      {isPro ? (
        <button
          onClick={cancel}
          disabled={busy}
          className="rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-60"
          style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}
        >
          {busy ? "Cancelling…" : "Cancel membership"}
        </button>
      ) : (
        <button
          onClick={upgrade}
          disabled={busy}
          className="rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60"
          style={{ background: "var(--red)", color: "#fff5f6" }}
        >
          {busy ? "Starting checkout…" : "Upgrade to Pro"}
        </button>
      )}
    </div>
  );
}
