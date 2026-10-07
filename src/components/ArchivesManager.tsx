"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Dump = {
  id: string;
  created_at: string;
  trigger: "auto" | "manual";
  counts: { bouts?: number; live_votes?: number; pred_slates?: number; pred_games?: number };
  files: { bucket: string; path: string }[];
  payload_bytes: number;
  downloaded_at: string | null;
  purged_at: string | null;
  purge_summary: { deleted?: Record<string, number>; kept?: unknown[] } | null;
  files_purged_at: string | null;
};
export type ArchivedItem = { type: string; id: string; title: string; archived_at: string; dump_id: string | null; has_money: boolean };
type FileLink = { name: string; path: string; url: string | null };

const TYPE_LABEL: Record<string, string> = { bout: "Bout", live_vote: "Live vote", pred_slate: "Prediction bracket", pred_game: "Prediction game" };
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" });
const kb = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

export default function ArchivesManager({ dumps, items }: { dumps: Dump[]; items: ArchivedItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [files, setFiles] = useState<Record<string, FileLink[]>>({});

  const btn = "rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50";
  const border = { borderColor: "var(--border)" };
  const pending = items.filter((i) => !i.dump_id);

  async function runNow() {
    setBusy("run");
    setMsg(null);
    const { data, error } = await createClient().rpc("admin_archive_run");
    setBusy(null);
    setMsg(error ? error.message : data ? "Dump created. Download it below." : "Nothing is archived yet, so there is nothing to dump.");
    if (!error) router.refresh();
  }

  async function restore(i: ArchivedItem) {
    setBusy(i.id);
    const { error } = await createClient().rpc("admin_restore_archived", { p_type: i.type, p_id: i.id });
    setBusy(null);
    setMsg(error ? error.message : `${i.title} restored.`);
    if (!error) router.refresh();
  }

  async function loadFiles(d: Dump) {
    setBusy(`f-${d.id}`);
    const r = await fetch(`/api/admin/archives/${d.id}/files`);
    const out = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setMsg(out.error ?? "Couldn't load files.");
    setFiles((f) => ({ ...f, [d.id]: out.files }));
  }

  async function purge(d: Dump, retry = false) {
    const ok = retry || window.confirm("Permanently delete the archived items and their clip files from the site? Only do this after you've saved the zip and the clip files. The zip is then the only copy. Items with payment records are kept.");
    if (!ok) return;
    setBusy(`p-${d.id}`);
    setMsg(null);
    const r = await fetch(`/api/admin/archives/${d.id}/purge${retry ? "?retry=1" : ""}`, { method: "POST" });
    const out = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setMsg(out.error ?? "Purge failed.");
    setMsg(`Purged. Removed ${out.filesRemoved} clip files${out.filesFailed ? ` (${out.filesFailed} failed, use Retry)` : ""}${out.kept?.length ? `; kept ${out.kept.length} item(s) with payment records` : ""}.`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      {msg && <p role="status" className="rounded-lg border p-3 text-sm font-semibold" style={border}>{msg}</p>}

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Archived, not dumped yet ({pending.length})</h2>
          <button type="button" className="bc-btn-solid rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60" disabled={busy === "run" || pending.length === 0} onClick={runNow}>
            {busy === "run" ? "Building…" : "Run archive now"}
          </button>
        </div>
        {pending.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>Nothing waiting. Use the 📦 Archive buttons on the Bouts, Live Vote and Predict admin pages.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm" style={{ ...border, background: "var(--surface)" }}>
                <span className="min-w-0"><span className="font-semibold">{i.title}</span> <span style={{ color: "var(--text-faint)" }}>· {TYPE_LABEL[i.type]} · archived {when(i.archived_at)}</span></span>
                <button type="button" className={btn} style={border} disabled={busy === i.id} onClick={() => restore(i)}>Restore</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Dumps</h2>
        {dumps.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>No dumps yet. The first automatic one runs on the 1st of the month.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {dumps.map((d) => {
              const c = d.counts ?? {};
              const links = files[d.id];
              return (
                <div key={d.id} className="rounded-xl border p-4" style={{ ...border, background: "var(--surface)" }}>
                  <p className="font-semibold">{when(d.created_at)} <span className="text-xs font-normal" style={{ color: "var(--text-faint)" }}>· {d.trigger === "auto" ? "monthly" : "manual"} · {kb(d.payload_bytes)}</span></p>
                  <p className="mb-3 text-sm" style={{ color: "var(--text-dim)" }}>
                    {c.bouts ?? 0} bouts · {c.live_votes ?? 0} live votes · {c.pred_slates ?? 0} brackets · {c.pred_games ?? 0} games · {d.purged_at ? d.files_purged_at || d.files.length === 0 ? "clips removed" : `${d.files.length} clip files still to remove` : `${d.files.length} clip files`}
                  </p>
                  {d.purged_at ? (
                    <p className="text-sm" style={{ color: "var(--text-faint)" }}>
                      Purged {when(d.purged_at)}. {d.purge_summary?.kept?.length ? `${d.purge_summary.kept.length} item(s) with payment records were kept (still hidden). ` : ""}
                      {!d.files_purged_at && d.files.length > 0 && (
                        <button type="button" className={`${btn} ml-2`} style={border} disabled={busy === `p-${d.id}`} onClick={() => purge(d, true)}>Retry clip cleanup</button>
                      )}
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <a href={`/api/admin/archives/${d.id}/download`} className="bc-btn-solid rounded-full px-4 py-2 text-xs font-bold" onClick={() => setTimeout(() => router.refresh(), 2500)}>⬇ Download data (zip)</a>
                      {d.files.length > 0 && <button type="button" className={btn} style={border} disabled={busy === `f-${d.id}`} onClick={() => loadFiles(d)}>Get clip download links</button>}
                      <button type="button" className={btn} style={{ ...border, color: d.downloaded_at ? "var(--danger)" : undefined }} disabled={!d.downloaded_at || busy === `p-${d.id}`} onClick={() => purge(d)} title={d.downloaded_at ? "" : "Download the zip first"}>
                        {busy === `p-${d.id}` ? "Purging…" : "Confirm downloaded & purge"}
                      </button>
                      {!d.downloaded_at && <span className="text-xs" style={{ color: "var(--text-faint)" }}>Download the zip to unlock purge.</span>}
                    </div>
                  )}
                  {links && (
                    <ul className="mt-3 max-h-60 overflow-auto text-sm">
                      {links.map((f) => (
                        <li key={f.path} className="truncate">
                          {f.url ? <a href={f.url} className="underline" style={{ color: "var(--blue)" }}>{f.name}</a> : <span>{f.name} (missing in storage)</span>}
                        </li>
                      ))}
                      <li className="pt-1 text-xs" style={{ color: "var(--text-faint)" }}>Links expire after 1 hour.</li>
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
