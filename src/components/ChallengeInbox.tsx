"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Challenge } from "@/lib/types";

const STATUS_STYLE: Record<Challenge["status"], { bg: string; color: string }> = {
  pending: { bg: "var(--gold-soft)", color: "var(--gold)" },
  accepted: { bg: "var(--blue-soft)", color: "var(--blue)" },
  declined: { bg: "var(--surface-2)", color: "var(--text-faint)" },
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ChallengeInbox({
  incoming,
  outgoing,
}: {
  incoming: Challenge[];
  outgoing: Challenge[];
}) {
  const supabase = createClient();
  const [incomingList, setIncomingList] = useState(incoming);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(id: string, status: "accepted" | "declined") {
    setBusyId(id);
    setError(null);
    const { error } = await supabase
      .from("challenges")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", id);
    setBusyId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setIncomingList((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p className="rounded-lg p-3 text-sm" style={{ background: "var(--red-soft)", color: "var(--red)" }}>
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
          Incoming
        </h2>
        <div className="bc-card overflow-hidden">
          {incomingList.length === 0 ? (
            <p className="p-4 text-sm" style={{ color: "var(--text-faint)" }}>
              No challenges yet.
            </p>
          ) : (
            incomingList.map((c, i) => (
              <div
                key={c.id}
                className="flex items-center gap-3.5 px-4 py-3.5"
                style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">
                    {c.challenger?.username ?? "Someone"} called you out
                  </div>
                  {c.message && (
                    <p className="mt-0.5 text-sm" style={{ color: "var(--text-dim)" }}>
                      &ldquo;{c.message}&rdquo;
                    </p>
                  )}
                  <div className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
                    {timeAgo(c.created_at)}
                  </div>
                </div>
                {c.status === "pending" ? (
                  <div className="flex flex-shrink-0 gap-2">
                    <button
                      disabled={busyId === c.id}
                      onClick={() => respond(c.id, "accepted")}
                      className="rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                      style={{ background: "var(--blue)", color: "#fff" }}
                    >
                      Accept
                    </button>
                    <button
                      disabled={busyId === c.id}
                      onClick={() => respond(c.id, "declined")}
                      className="rounded-full border px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                      style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <span
                    className="flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase"
                    style={{
                      fontFamily: "var(--font-display)",
                      background: STATUS_STYLE[c.status].bg,
                      color: STATUS_STYLE[c.status].color,
                    }}
                  >
                    {c.status}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
          Outgoing
        </h2>
        <div className="bc-card overflow-hidden">
          {outgoing.length === 0 ? (
            <p className="p-4 text-sm" style={{ color: "var(--text-faint)" }}>
              You haven&apos;t called anyone out yet — try it from the leaderboard.
            </p>
          ) : (
            outgoing.map((c, i) => (
              <div
                key={c.id}
                className="flex items-center gap-3.5 px-4 py-3.5"
                style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">You called out {c.opponent?.username ?? "someone"}</div>
                  {c.message && (
                    <p className="mt-0.5 text-sm" style={{ color: "var(--text-dim)" }}>
                      &ldquo;{c.message}&rdquo;
                    </p>
                  )}
                  <div className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
                    {timeAgo(c.created_at)}
                  </div>
                </div>
                <span
                  className="flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase"
                  style={{
                    fontFamily: "var(--font-display)",
                    background: STATUS_STYLE[c.status].bg,
                    color: STATUS_STYLE[c.status].color,
                  }}
                >
                  {c.status}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
