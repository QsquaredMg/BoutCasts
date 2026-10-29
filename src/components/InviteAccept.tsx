"use client";

import Link from "next/link";
import { useState } from "react";
import { eventHref, type EventKind } from "@/lib/eventRoles";

// Accept or decline from the emailed link (token) or from a "Shared with me" row (id).
export default function InviteAccept({
  token,
  roleId,
  kind,
  eventId,
  role,
  compact = false,
  onDone,
}: {
  token?: string;
  roleId?: string;
  kind: EventKind;
  eventId?: string;
  role: "moderator" | "owner";
  compact?: boolean;
  onDone?: () => void;
}) {
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ kind: EventKind; id: string } | "declined" | null>(null);

  async function act(action: "accept" | "decline") {
    setBusy(action);
    setError(null);
    const res = token && action === "accept"
      ? await fetch("/api/event-roles/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      : await fetch(`/api/event-roles/${roleId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "That didn't work.");
      return;
    }
    if (action === "decline") setDone("declined");
    else setDone({ kind: (data.result?.kind as EventKind) ?? kind, id: (data.result?.event_id as string) ?? eventId ?? "" });
    onDone?.();
  }

  if (done === "declined") return <p className="text-sm font-semibold" style={{ color: "var(--text-dim)" }}>Declined.</p>;
  if (done) {
    return (
      <Link href={eventHref(done.kind, done.id)} className="bc-btn-solid inline-block rounded-full px-5 py-2.5 text-sm font-bold">
        {role === "owner" ? "Open it" : "Open it and start moderating"}
      </Link>
    );
  }
  return (
    <div>
      <div className={`flex gap-2 ${compact ? "" : "mt-4"}`}>
        <button type="button" disabled={!!busy} onClick={() => act("accept")} className="bc-btn-solid rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-60">
          {busy === "accept" ? "Accepting…" : role === "owner" ? "Take it over" : "Accept"}
        </button>
        {roleId && (
          <button type="button" disabled={!!busy} onClick={() => act("decline")} className="rounded-full border px-5 py-2.5 text-sm font-bold disabled:opacity-60" style={{ borderColor: "var(--border)" }}>
            Decline
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-semibold" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
