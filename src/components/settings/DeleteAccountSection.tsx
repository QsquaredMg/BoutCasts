"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);

  async function remove() {
    setBusy(true);
    setError(null);
    setBlockers([]);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Couldn't delete your account.");
        if (Array.isArray(json.blockers)) setBlockers(json.blockers);
        setBusy(false);
        return;
      }
      // Clear any lingering client session, then leave.
      await createClient().auth.signOut().catch(() => {});
      window.location.href = "/?account_deleted=1";
    } catch {
      setError("Network problem. Please try again.");
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <h2 className="mb-1 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Delete my account
      </h2>
      <p className="mb-3 text-sm" style={{ color: "var(--text-dim)" }}>
        Permanently deletes your profile, votes, predictions, comments, submissions, follows, badges, points and any
        wallet balance. Paid subscriptions are canceled. Records of payments are kept without your name for our
        accounting. This can&apos;t be undone.
      </p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg border px-4 py-2 text-sm font-bold"
          style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
        >
          Delete my account…
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="text-sm font-semibold" htmlFor="del-confirm">
            Type <span style={{ color: "var(--danger)" }}>DELETE</span> to confirm
          </label>
          <input
            id="del-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            className="w-full max-w-xs rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--bg)" }}
          />
          {error && (
            <div className="text-sm" style={{ color: "var(--danger)" }}>
              <p className="font-semibold">{error}</p>
              {blockers.length > 0 && (
                <ul className="mt-1 list-disc pl-5">
                  {blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={remove}
              disabled={busy || confirmText !== "DELETE"}
              className="rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              style={{ background: "var(--danger)" }}
            >
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setConfirmText("");
                setError(null);
                setBlockers([]);
              }}
              disabled={busy}
              className="rounded-lg border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: "var(--border)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
