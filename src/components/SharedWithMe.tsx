"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import InviteAccept from "@/components/InviteAccept";
import { KIND_LABEL, eventHref, type EventKind } from "@/lib/eventRoles";

type Invite = { id: string; kind: EventKind; event_id: string; role: "moderator" | "owner"; title: string | null; invited_by: string | null };
type Shared = { kind: EventKind; event_id: string; title: string | null; status: string | null };

// Invitations waiting for the signed-in user, and the events they moderate.
export default function SharedWithMe({ kind }: { kind?: EventKind }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [events, setEvents] = useState<Shared[]>([]);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [a, b] = await Promise.all([supabase.rpc("my_event_invites"), supabase.rpc("my_shared_events")]);
    setInvites(((a.data ?? []) as Invite[]).filter((i) => !kind || i.kind === kind));
    setEvents(((b.data ?? []) as Shared[]).filter((e) => !kind || e.kind === kind));
  }, [kind]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (invites.length === 0 && events.length === 0) return null;

  return (
    <section className="mb-8 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <h2 className="text-base font-extrabold">Shared with me</h2>
      {invites.length > 0 && (
        <ul className="mt-3 grid gap-3">
          {invites.map((i) => (
            <li key={i.id} className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
              <p className="text-sm font-semibold">
                {i.invited_by ? `@${i.invited_by}` : "Someone"} {i.role === "owner" ? "wants you to take over" : "invited you to help run"} &ldquo;{i.title ?? "an event"}&rdquo;
              </p>
              <p className="mb-2 text-xs" style={{ color: "var(--text-faint)" }}>{KIND_LABEL[i.kind]} · {i.role === "owner" ? "Ownership" : "Moderator"}</p>
              <InviteAccept roleId={i.id} kind={i.kind} eventId={i.event_id} role={i.role} compact onDone={load} />
            </li>
          ))}
        </ul>
      )}
      {events.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {events.map((e) => (
            <li key={`${e.kind}-${e.event_id}`}>
              <Link href={eventHref(e.kind, e.event_id)} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>
                <span className="truncate">{e.title ?? "Untitled"}</span>
                <span className="ml-3 shrink-0 text-xs" style={{ color: "var(--text-faint)" }}>{KIND_LABEL[e.kind]} · {e.status ?? ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
