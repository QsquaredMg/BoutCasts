"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Instrumental } from "@/lib/types";

type Status = Instrumental["status"];

const STATUS_COLOR: Record<Status, string> = {
  pending: "var(--text-dim)",
  approved: "var(--blue)",
  rejected: "var(--red)",
  removed: "var(--text-faint)",
};

// Admin review queue for the instrumental library. Admins approve, reject or
// remove tracks; RLS (instrumentals_admin_update) enforces who may do this.
export default function InstrumentalAdmin({ initial }: { initial: Instrumental[] }) {
  const supabase = createClient();
  const [items, setItems] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(id: string, status: Status) {
    setBusyId(id);
    setError(null);
    const { error } = await supabase.from("instrumentals").update({ status }).eq("id", id);
    setBusyId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  }

  const order: Status[] = ["pending", "approved", "rejected", "removed"];
  const sorted = [...items].sort(
    (a, b) => order.indexOf(a.status) - order.indexOf(b.status) || b.created_at.localeCompare(a.created_at)
  );

  if (sorted.length === 0) {
    return <p className="text-sm" style={{ color: "var(--text-faint)" }}>No instrumentals yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {sorted.map((i) => {
        const meta = [i.bpm ? `${i.bpm} BPM` : null, i.musical_key, i.genre, i.license_type.replace(/_/g, " ")]
          .filter(Boolean)
          .join(" · ");
        return (
          <div key={i.id} className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--border)" }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-bold">{i.title}</span>{" "}
                <span style={{ color: "var(--text-faint)" }}>by {i.producer_name}</span>
              </div>
              <span className="text-xs font-bold uppercase" style={{ color: STATUS_COLOR[i.status] }}>
                {i.status}
              </span>
            </div>
            <div className="mb-2 text-xs" style={{ color: "var(--text-faint)" }}>{meta}</div>
            {i.license_source_url && (
              <a
                href={i.license_source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-2 block text-xs underline"
                style={{ color: "var(--blue)" }}
              >
                License source
              </a>
            )}
            <audio controls preload="none" src={i.file_url} className="mb-2 w-full" />
            <div className="flex flex-wrap gap-2">
              {i.status !== "approved" && (
                <button
                  disabled={busyId === i.id}
                  onClick={() => setStatus(i.id, "approved")}
                  className="rounded bg-green-600 px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
                >
                  Approve
                </button>
              )}
              {i.status === "pending" && (
                <button
                  disabled={busyId === i.id}
                  onClick={() => setStatus(i.id, "rejected")}
                  className="rounded bg-red-600 px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
                >
                  Reject
                </button>
              )}
              {i.status === "approved" && (
                <button
                  disabled={busyId === i.id}
                  onClick={() => setStatus(i.id, "removed")}
                  className="rounded border px-3 py-1 text-xs font-bold disabled:opacity-50"
                  style={{ borderColor: "var(--border)" }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
