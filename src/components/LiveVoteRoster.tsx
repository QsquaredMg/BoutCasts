"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = { name: string; email: string | null; joined_at: string };

// Organizer view of who joined with a name (private events) and the switch to also ask for email.
// Names and emails are stored apart from ballots, so you can't tell who voted for what.
export default function LiveVoteRoster({ eventId, isPrivate, closed }: { eventId: string; isPrivate: boolean; closed: boolean }) {
  const [sb] = useState(() => createClient());
  const [available, setAvailable] = useState(false);
  const [askEmail, setAskEmail] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: ev, error: e1 }, { data: list, error: e2 }] = await Promise.all([
      sb.from("live_vote_events").select("collect_voter_email").eq("id", eventId).maybeSingle(),
      sb.rpc("live_vote_participants", { p_event_id: eventId }),
    ]);
    if (e1 || e2) return setAvailable(false); // guest pass SQL not installed yet
    setAvailable(true);
    setAskEmail(Boolean((ev as { collect_voter_email?: boolean } | null)?.collect_voter_email));
    setRows((list as Row[]) ?? []);
  }, [sb, eventId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function toggle() {
    setErr(null);
    const { error } = await sb.rpc("set_live_vote_collect_email", { p_event_id: eventId, p_on: !askEmail });
    if (error) return setErr(error.message);
    load();
  }

  function csv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const body = ["Name,Email,Joined", ...rows.map((r) => [esc(r.name), esc(r.email ?? ""), esc(r.joined_at)].join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
    a.download = "participants.csv";
    a.click();
  }

  if (!available) return null;
  return (
    <div className="mb-4 rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <p className="text-sm font-semibold">Voter names {isPrivate ? "(asked before the first vote)" : ""}</p>
      {!closed && (
        <label className="mt-2 flex cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--red)]" checked={askEmail} onChange={toggle} />
          <span className="text-sm">
            Also ask for an email
            <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
              Leave this off for school and youth events. Voters then give a name or nickname only.
              {!isPrivate && !askEmail ? " Public events ask for nothing unless this is on." : ""}
            </span>
          </span>
        </label>
      )}
      {err && <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>{err}</p>}
      <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
        {rows.length} joined. Names are kept apart from ballots, so you can&apos;t see who voted for what.
      </p>
      {rows.length > 0 && (
        <div className="mt-2 flex gap-3 text-sm">
          <button onClick={() => setOpen((o) => !o)} className="font-semibold underline">{open ? "Hide list" : "Show list"}</button>
          <button onClick={csv} className="font-semibold underline">Download CSV</button>
        </div>
      )}
      {open && (
        <ul className="mt-2 max-h-48 overflow-auto text-sm">
          {rows.map((r, i) => (
            <li key={i} className="flex justify-between gap-3 border-t py-1" style={{ borderColor: "var(--border)" }}>
              <span>{r.name}</span><span style={{ color: "var(--text-faint)" }}>{r.email ?? ""}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
