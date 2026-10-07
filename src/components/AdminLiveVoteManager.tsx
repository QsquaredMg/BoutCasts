"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "live" | "closed";
  tier: string;
  price_cents: number;
  ads_enabled: boolean;
  created_at: string;
  organizer_id: string;
  organizer_username: string | null;
  closes_at: string | null;
};

const STATUS_STYLE: Record<EventRow["status"], { bg: string; fg: string }> = {
  draft: { bg: "var(--surface-2)", fg: "var(--text-dim)" },
  live: { bg: "rgba(34,197,94,0.15)", fg: "#22c55e" },
  closed: { bg: "var(--surface-2)", fg: "var(--text-faint)" },
};

export default function AdminLiveVoteManager({
  initialEvents,
  currentUserId,
}: {
  initialEvents: EventRow[];
  currentUserId: string | null;
}) {
  const supabase = createClient();
  const [events, setEvents] = useState(initialEvents);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingEndId, setEditingEndId] = useState<string | null>(null);
  const [endInput, setEndInput] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", status: "live" as EventRow["status"], closes_at: "" });

  function toLocalInput(iso: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function startEdit(ev: EventRow) {
    setEditId(ev.id);
    setForm({ title: ev.title, description: ev.description ?? "", status: ev.status, closes_at: toLocalInput(ev.closes_at) });
  }

  async function saveEdit(ev: EventRow) {
    setError(null);
    setSavingId(ev.id);
    const closesIso = form.closes_at ? new Date(form.closes_at).toISOString() : null;
    const { error } = await supabase.rpc("admin_update_live_vote", {
      p_id: ev.id,
      p_title: form.title,
      p_description: form.description,
      p_status: form.status,
      p_closes_at: closesIso,
      p_clear_close: !closesIso,
    });
    setSavingId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setEvents((prev) => prev.map((e) => (e.id === ev.id ? { ...e, title: form.title.trim() || e.title, description: form.description, status: form.status, closes_at: closesIso } : e)));
    setEditId(null);
  }

  async function closeNow(ev: EventRow) {
    if (!confirm(`Close voting on "${ev.title}" now? Nobody will be able to vote after this.`)) return;
    setError(null);
    setSavingId(ev.id);
    const { error } = await supabase.rpc("close_live_vote_event", { p_event_id: ev.id });
    setSavingId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setEvents((prev) =>
      prev.map((e) => (e.id === ev.id ? { ...e, status: "closed", closes_at: new Date().toISOString() } : e))
    );
  }

  async function archiveEvent(ev: EventRow) {
    if (!confirm(`Archive "${ev.title}"? It disappears from the site and goes to Admin → Archives for the next downloadable dump. You can restore it until it is purged.`)) return;
    setError(null);
    setSavingId(ev.id);
    const { error } = await supabase.rpc("admin_archive_item", { p_type: "live_vote", p_id: ev.id });
    setSavingId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== ev.id));
  }

  async function deleteEvent(ev: EventRow) {
    if (!confirm(`Permanently delete "${ev.title}" and all its votes? This cannot be undone. Use Archive instead if you want a downloadable copy.`)) return;
    setError(null);
    setSavingId(ev.id);
    let { error } = await supabase.rpc("admin_delete_live_vote", { p_id: ev.id, p_force: false });
    if (error?.message.startsWith("MONEY:")) {
      if (confirm(`"${ev.title}" has payment records (sponsorships or a Stripe checkout). Deleting removes them from the site database; Stripe keeps its own record. Delete anyway?`)) {
        ({ error } = await supabase.rpc("admin_delete_live_vote", { p_id: ev.id, p_force: true }));
      } else {
        setSavingId(null);
        return;
      }
    }
    setSavingId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== ev.id));
  }

  async function setEnd(eventId: string, closesAt: string | null) {
    setError(null);
    setSavingId(eventId);
    const { error } = await supabase.rpc("admin_set_live_vote_closes_at", { p_event_id: eventId, p_closes_at: closesAt });
    setSavingId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setEditingEndId(null);
    setEndInput("");
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, closes_at: closesAt } : e)));
  }

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
                  <a
                    href={e.organizer_id === currentUserId ? `/live-vote/${e.id}` : `/vote/${e.id}`}
                    className="truncate text-sm font-semibold hover:underline"
                  >
                    {e.title}
                  </a>
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
                  {e.status === "live" && (
                    <>
                      {" "}&middot;{" "}
                      <span style={{ color: e.closes_at ? undefined : "var(--red)", fontWeight: e.closes_at ? undefined : 700 }}>
                        {e.closes_at
                          ? `closes ${new Date(e.closes_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                          : "no end time"}
                      </span>
                    </>
                  )}
                </div>
                {e.status === "live" && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {editingEndId === e.id ? (
                      <>
                        <input
                          type="datetime-local"
                          value={endInput}
                          onChange={(ev) => setEndInput(ev.target.value)}
                          className="rounded-lg border px-2 py-1 text-xs"
                          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                        />
                        <button
                          onClick={() => endInput && setEnd(e.id, new Date(endInput).toISOString())}
                          disabled={!endInput || savingId === e.id}
                          className="rounded-full border px-3 py-1 text-xs font-bold disabled:opacity-50"
                          style={{ borderColor: "var(--border)" }}
                        >
                          Save
                        </button>
                        <button onClick={() => setEditingEndId(null)} className="px-2 py-1 text-xs" style={{ color: "var(--text-faint)" }}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingEndId(e.id);
                            setEndInput("");
                          }}
                          className="rounded-full border px-3 py-1 text-xs font-bold"
                          style={{ borderColor: "var(--border)" }}
                        >
                          {e.closes_at ? "Change end time" : "Set end time"}
                        </button>
                        {e.closes_at && (
                          <button
                            onClick={() => setEnd(e.id, null)}
                            disabled={savingId === e.id}
                            className="rounded-full border px-3 py-1 text-xs font-bold disabled:opacity-50"
                            style={{ borderColor: "var(--border)" }}
                          >
                            No end time
                          </button>
                        )}
                        <button
                          onClick={() => closeNow(e)}
                          disabled={savingId === e.id}
                          className="rounded-full px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
                          style={{ background: "var(--danger)" }}
                        >
                          Close voting now
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {editId === e.id && (
                <div className="flex w-full flex-col gap-2 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                  <input value={form.title} onChange={(ev) => setForm((f) => ({ ...f, title: ev.target.value }))} placeholder="Title" className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
                  <textarea value={form.description} onChange={(ev) => setForm((f) => ({ ...f, description: ev.target.value }))} placeholder="Description" rows={2} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={form.status} onChange={(ev) => setForm((f) => ({ ...f, status: ev.target.value as EventRow["status"] }))} className="rounded border px-2 py-1.5 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                      <option value="draft">Draft</option>
                      <option value="live">Live</option>
                      <option value="closed">Closed</option>
                    </select>
                    <input type="datetime-local" value={form.closes_at} onChange={(ev) => setForm((f) => ({ ...f, closes_at: ev.target.value }))} className="rounded border px-2 py-1.5 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }} title="Closing time (blank = none)" />
                    <button onClick={() => saveEdit(e)} disabled={savingId === e.id} className="rounded-full px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50" style={{ background: "var(--red)" }}>Save</button>
                    <button onClick={() => setEditId(null)} className="px-2 py-1 text-xs" style={{ color: "var(--text-faint)" }}>Cancel</button>
                  </div>
                  <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>Admins can change status and end time at any stage, including reopening a closed vote.</p>
                </div>
              )}
              {
                <div className="flex gap-1.5">
                  <button onClick={() => startEdit(e)} disabled={savingId === e.id} className="rounded-full border px-3 py-1 text-xs font-bold disabled:opacity-50" style={{ borderColor: "var(--border)" }}>
                    ✏️ Edit
                  </button>
                  <button onClick={() => archiveEvent(e)} disabled={savingId === e.id} className="rounded-full border px-3 py-1 text-xs font-bold disabled:opacity-50" style={{ borderColor: "var(--border)" }}>
                    📦 Archive
                  </button>
                  <button onClick={() => deleteEvent(e)} disabled={savingId === e.id} className="rounded-full border px-3 py-1 text-xs font-bold disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--danger)" }}>
                    Delete
                  </button>
                </div>
              }
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
