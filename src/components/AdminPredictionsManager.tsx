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
  const [editKey, setEditKey] = useState<string | null>(null);
  const [f, setF] = useState({ title: "", home: "", away: "", starts: "", closes: "", status: "scheduled" });

  function toLocal(iso: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function startEdit(r: AdminPredRow) {
    const i = r.title.indexOf(" vs ");
    setF({
      title: r.title,
      home: r.kind === "game" && i > 0 ? r.title.slice(0, i) : "",
      away: r.kind === "game" && i > 0 ? r.title.slice(i + 4) : "",
      starts: r.kind === "game" ? toLocal(r.starts_at) : "",
      closes: r.kind === "bracket" ? toLocal(r.closes_at) : "",
      status: r.status,
    });
    setEditKey(`${r.kind}-${r.id}`);
  }

  async function saveEdit(r: AdminPredRow) {
    const k = `${r.kind}-${r.id}`;
    if (r.kind === "game") {
      await run(k, "admin_update_pred_game", {
        p_id: r.id, p_home_name: f.home, p_away_name: f.away,
        p_starts_at: f.starts ? new Date(f.starts).toISOString() : null,
        p_status: f.status !== r.status ? f.status : null,
      }, "Game updated.");
    } else {
      await run(k, "admin_update_pred_slate", {
        p_id: r.id, p_title: f.title,
        p_closes_at: f.closes ? new Date(f.closes).toISOString() : null,
        p_clear_close: !f.closes,
      }, "Bracket updated.");
    }
    setEditKey(null);
  }

  async function deleteRow(r: AdminPredRow) {
    const k = `${r.kind}-${r.id}`;
    if (!window.confirm("Permanently delete this and all its predictions? This cannot be undone. Use Archive instead if you want a downloadable copy.")) return;
    const { error } = await createClient().rpc("admin_delete_pred", { p_kind: r.kind, p_id: r.id, p_force: false });
    if (error?.message.startsWith("MONEY:")) {
      if (!window.confirm("This was paid for. Deleting removes it and its picks from the site database (Stripe keeps its own payment record). Delete anyway?")) return;
      await run(k, "admin_delete_pred", { p_kind: r.kind, p_id: r.id, p_force: true }, "Deleted.");
      return;
    }
    setMsg(error ? error.message : "Deleted.");
    if (!error) router.refresh();
  }

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
              <button type="button" disabled={busy === k} className={btn} style={border} onClick={() => startEdit(r)}>✏️ Edit</button>
              <button type="button" disabled={busy === k} className={btn} style={border} onClick={() => { if (window.confirm("Archive this? It leaves the site and goes to Admin → Archives for the next downloadable dump. You can restore it until it is purged.")) run(k, "admin_archive_item", { p_type: r.kind === "bracket" ? "pred_slate" : "pred_game", p_id: r.id }, "Archived."); }}>📦 Archive</button>
              <button type="button" disabled={busy === k} className={btn} style={{ ...border, color: "var(--red)" }} onClick={() => deleteRow(r)}>Delete</button>
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
            {editKey === k && (
              <div className="flex w-full flex-wrap items-center gap-2 border-t pt-3" style={border}>
                {r.kind === "bracket" ? (
                  <>
                    <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Title" className="min-w-[12rem] flex-1 rounded border px-3 py-1.5 text-sm" style={{ ...border, background: "var(--surface)" }} />
                    <label className="text-xs" style={{ color: "var(--text-dim)" }}>Closes <input type="datetime-local" value={f.closes} onChange={(e) => setF({ ...f, closes: e.target.value })} className="ml-1 rounded border px-2 py-1 text-sm" style={{ ...border, background: "var(--surface)" }} /></label>
                  </>
                ) : (
                  <>
                    <input value={f.home} onChange={(e) => setF({ ...f, home: e.target.value })} placeholder="Home team" className="rounded border px-3 py-1.5 text-sm" style={{ ...border, background: "var(--surface)" }} />
                    <input value={f.away} onChange={(e) => setF({ ...f, away: e.target.value })} placeholder="Away team" className="rounded border px-3 py-1.5 text-sm" style={{ ...border, background: "var(--surface)" }} />
                    <input type="datetime-local" value={f.starts} onChange={(e) => setF({ ...f, starts: e.target.value })} className="rounded border px-2 py-1.5 text-sm" style={{ ...border, background: "var(--surface)" }} />
                    <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="rounded border px-2 py-1.5 text-sm" style={{ ...border, background: "var(--surface)" }}>
                      <option value="scheduled">Scheduled (clears score)</option>
                      <option value="cancelled">Cancelled</option>
                      {r.status === "final" && <option value="final">Final (keep)</option>}
                    </select>
                  </>
                )}
                <button type="button" disabled={busy === k} className={btn} style={{ ...border, color: "var(--red)" }} onClick={() => saveEdit(r)}>Save</button>
                <button type="button" className={btn} style={border} onClick={() => setEditKey(null)}>Cancel</button>
                <span className="w-full text-[11px]" style={{ color: "var(--text-faint)" }}>Enter or correct a final score with “Manage / enter score”. Admins can edit at any stage.</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
