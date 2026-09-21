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
    return <p className="text-neutral-500">Nothing pending — queue is clear.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="rounded bg-red-100 p-3 text-sm text-red-700">{error}</p>}
      {items.map((s) => (
        <div key={s.id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-neutral-500">
              {s.categories?.name ?? "Uncategorized"}
            </span>
            {s.entry_type === "paid" && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase text-amber-700">
                Paid entry &middot; {s.entry_fee} BB
              </span>
            )}
          </div>
          <div className="mb-1 font-semibold">{s.title}</div>
          <div className="mb-3 text-sm text-neutral-500">
            {s.source_type}
            {s.source_url ? `: ${s.source_url}` : ""}
          </div>
          {s.entry_type === "paid" && (
            <p className="mb-3 text-xs text-neutral-400">
              Rejecting this credits {s.entry_fee} BoutBucks to the submitter&apos;s
              wallet instead of a cash refund.
            </p>
          )}
          <div className="flex gap-2">
            <button
              disabled={busyId === s.id}
              onClick={() => moderate(s.id, true)}
              className="flex-1 rounded-lg border-2 border-green-500 py-2 font-semibold text-green-700 hover:bg-green-50 disabled:opacity-60"
            >
              Approve
            </button>
            <button
              disabled={busyId === s.id}
              onClick={() => moderate(s.id, false)}
              className="flex-1 rounded-lg border-2 border-red-500 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
