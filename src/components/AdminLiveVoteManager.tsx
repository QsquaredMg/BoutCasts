"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type EventRow = {
  id: string;
  title: string;
  status: "draft" | "live" | "closed";
  tier: string;
  price_cents: number;
  ads_enabled: boolean;
  created_at: string;
  organizer_id: string;
  organizer_username: string | null;
};

const STATUS_STYLE: Record<EventRow["status"], { bg: string; fg: string }> = {
  draft: { bg: "var(--surface-2)", fg: "var(--text-dim)" },
  live: { bg: "rgba(34,197,94,0.15)", fg: "#22c55e" },
  closed: { bg: "var(--surface-2)", fg: "var(--text-faint)" },
};

export default function AdminLiveVoteManager({ initialEvents }: { initialEvents: EventRow[] }) {
  const supabase = createClient();
  const [events, setEvents] = useState(initialEvents);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function toggleAds(eventId: string, next: boolean) {
    setError(null);
    setSavingId(eventId);
    const { error } = await supabase.rpc("admin_set_live_vote_ads_enabled", {
      p_event_id: eventId,
      p_enabled: next,
    });
    setSavingId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, ads_enabled: next } : e)));
  }

  if (events.length === 0) {
    return <p className="text-sm" style={{ color: "var(--text-faint)" }}>No Live Vote events yet.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {error && <p className="rounded bg-red-100 p-3 text-sm text-red-700">{error}</p>}

      <div className="flex flex-col gap-2">
        {events.map((e) => {
          const statusStyle = STATUS_STYLE[e.status];
          return (
            <div
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{e.title}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: statusStyle.bg, color: statusStyle.fg }}
                  >
                    {e.status}
                  </span>
                </div>
                <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {e.organizer_username ? `@${e.organizer_username}` : "unknown organizer"} &middot; {e.tier} &middot; $
                  {(e.price_cents / 100).toFixed(2)}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                <span>Show ads</span>
                <input
                  type="checkbox"
                  checked={e.ads_enabled}
                  disabled={savingId === e.id}
                  onChange={(ev) => toggleAds(e.id, ev.target.checked)}
                  className="h-4 w-4"
                />
              </label>
            </div>
          );
        })}
      </div>

      <p className="text-xs" style={{ color: "var(--text-faint)" }}>
        When on, the public ballot page for that event pulls a sponsored ad the same way the matchups feed does —
        create or manage the creative itself from the{" "}
        <a href="/admin/ads" className="underline">
          Ads
        </a>{" "}
        page under the &quot;Live Vote&quot; placement.
      </p>
    </div>
  );
}
