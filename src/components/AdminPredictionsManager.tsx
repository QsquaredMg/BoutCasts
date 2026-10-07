"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LocalTime from "@/components/LocalTime";
import { useNow } from "@/lib/predictions/useNow";

export type AdminPredRow = {
  kind: "bracket" | "game";
  id: string;
  title: string;
  status: string;
  tier: string | null;
  starts_at: string | null;
  closes_at: string | null;
  owner: string | null;
  games: number;
  picks: number;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled", final: "Final", cancelled: "Cancelled", pending: "Not paid", open: "Open", closed: "Closed",
};

export default function AdminPredictionsManager({ rows }: { rows: AdminPredRow[] }) {
  const router = useRouter();
  const now = useNow();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(key: string, name: string, args: Record<string, unknown>, ok: string) {
    setBusy(key);
    setMsg(null);
    const { error } = await createClient().rpc(name, args);
    setBusy(null);
    setMsg(error ? error.message : ok);
    if (!error) router.refresh();
  }

  const btn = "rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50";
  const border = { borderColor: "var(--border)" };

  if (rows.length === 0) return <p className="text-sm" style={{ color: "var(--text-faint)" }}>No predictions have been created yet.</p>;

  return (
    <div className="flex flex-col gap-2">
      {msg && <p role="status" className="text-sm font-semibold" style={{ color: "var(--text-dim)" }}>{msg}</p>}
      {rows.map((r) => {
        const future = r.starts_at ? now !== 0 && new Date(r.starts_at).getTime() > now : false;
        const href = r.kind === "bracket" ? `/predictions/slate/${r.id}` : `/predictions/${r.id}`;
        const k = `${r.kind}-${r.id}`;
        return (
          <div key={k} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" style={{ ...border, background: "var(--surface)" }}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{r.title}</p>
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                {r.kind === "bracket" ? `Bracket (${r.tier})` : "Single game"} · {STATUS_LABEL[r.status] ?? r.status} · {r.owner ?? "unknown"} · {r.games} {r.games === 1 ? "game" : "games"} · {r.picks} picks
                {r.starts_at ? <> · {r.kind === "bracket" ? "locks" : "starts"} <LocalTime iso={r.starts_at} /></> : null}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={href} className={btn} style={border}>Manage / enter score</Link>
              {r.kind === "game" && r.status === "scheduled" && future && (
                <button type="button" disabled={busy === k} className={btn} style={border} onClick={() => run(k, "admin_start_pred_game", { p_game: r.id }, "Game started. Predictions are closed.")}>Start now</button>
              )}
              {r.kind === "game" && r.status === "scheduled" && (
                <button type="button" disabled={busy === k} className={btn} style={{ ...border, color: "var(--red)" }} onClick={() => { if (window.confirm("Cancel this game?")) run(k, "cancel_pred_game", { p_game: r.id }, "Game cancelled."); }}>Cancel</button>
              )}
              {(r.kind === "bracket" ? ["closed", "pending"].includes(r.status) : ["final", "cancelled"].includes(r.status)) && (
                <button type="button" disabled={busy === k} className={btn} style={border} onClick={() => { if (window.confirm("Archive this? It leaves the site and goes to Admin → Archives for the next downloadable dump. You can restore it until it is purged.")) run(k, "admin_archive_item", { p_type: r.kind === "bracket" ? "pred_slate" : "pred_game", p_id: r.id }, "Archived."); }}>📦 Archive</button>
              )}
              {(r.kind === "bracket" ? r.status !== "open" : r.status !== "scheduled") && (
                <button type="button" disabled={busy === k} className={btn} style={{ ...border, color: "var(--red)" }} onClick={() => { if (window.confirm("Permanently delete this and all its predictions? This cannot be undone. Use Archive instead if you want a downloadable copy.")) run(k, "admin_delete_pred", { p_kind: r.kind, p_id: r.id }, "Deleted."); }}>Delete</button>
              )}
              {r.kind === "bracket" && r.status === "pending" && (
                <button type="button" disabled={busy === k} className={btn} style={border} onClick={() => run(k, "admin_open_pred_bracket", { p_id: r.id, p_tier: "season" }, "Bracket opened (free).")}>Open free</button>
              )}
              {r.kind === "bracket" && r.status === "open" && (
                <button type="button" disabled={busy === k} className={btn} style={{ ...border, color: "var(--red)" }} onClick={() => { if (window.confirm("Close this bracket to new predictions?")) run(k, "close_pred_bracket", { p_id: r.id }, "Bracket closed."); }}>End</button>
              )}
              {r.kind === "bracket" && r.status === "closed" && (
                <button type="button" disabled={busy === k} className={btn} style={border} onClick={() => run(k, "admin_reopen_pred_bracket", { p_id: r.id }, "Bracket reopened.")}>Reopen</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
