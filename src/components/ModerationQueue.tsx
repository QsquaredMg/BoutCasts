"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Submission } from "@/lib/types";

export default function ModerationQueue({ submissions }: { submissions: Submission[] }) {
  const supabase = createClient();
  const [items, setItems] = useState(submissions);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function moderate(id: string, approve: boolean) {
    setBusyId(id);
    setError(null);
    const { error } = await supabase.rpc("moderate_submission", {
      p_submission_id: id,
      p_approve: approve,
    });
    if (error) {
      setError(error.message);
      setBusyId(null);
      return;
    }
    setItems((prev) => prev.filter((s) => s.id !== id));
    setBusyId(null);
  }

  if (items.length === 0) {
    return <p style={{ color: "var(--text-faint)" }}>Nothing pending — queue is clear.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-lg p-3 text-sm" style={{ background: "var(--red-soft)", color: "var(--red)" }}>
          {error}
        </p>
      )}
      {items.map((s) => (
        <div key={s.id} className="bc-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase" style={{ color: "var(--text-faint)" }}>
              {s.categories?.name ?? "Uncategorized"}
            </span>
            {s.entry_type === "paid" && (
              <span className="bc-badge-gold rounded-full px-2 py-0.5 text-xs font-bold uppercase">
                Paid entry &middot; {s.entry_fee} BB
              </span>
            )}
          </div>
          <div className="mb-1 font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {s.title}
          </div>
          <div className="mb-3 text-sm" style={{ color: "var(--text-faint)" }}>
            {s.source_type}
            {s.source_url ? `: ${s.source_url}` : ""}
          </div>
          {s.entry_type === "paid" && (
            <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
              Rejecting this credits {s.entry_fee} BoutBucks to the submitter&apos;s
              wallet instead of a cash refund.
            </p>
          )}
          <div className="flex gap-2">
            <button
              disabled={busyId === s.id}
              onClick={() => moderate(s.id, true)}
              className="bc-btn-outline-blue flex-1 border-2 py-2 disabled:opacity-60"
            >
              Approve
            </button>
            <button
              disabled={busyId === s.id}
              onClick={() => moderate(s.id, false)}
              className="bc-btn-outline-red flex-1 border-2 py-2 disabled:opacity-60"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
