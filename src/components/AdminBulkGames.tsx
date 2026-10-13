"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TEAM_FIELDS, LEAGUE_LABEL, type DirectoryTeam } from "@/lib/teams/directory";
import { matchTeams, teamDisplayName, teamLogo } from "@/lib/teams/match";
import { BULK_MAX, CSV_TEMPLATE, parsePaste, rowsFromCsv, type BulkRow } from "@/lib/predictions/bulk";
import { useNow } from "@/lib/predictions/useNow";
import { useZone } from "@/lib/time/pref";
import { isoToWall, wallToIso } from "@/lib/time/zones";
import TimeZoneSelect from "@/components/TimeZoneSelect";

type Row = BulkRow & {
  homeLogo: string; awayLogo: string;
  homeCands: DirectoryTeam[]; awayCands: DirectoryTeam[];
  result?: { ok: boolean; id?: string; duplicate?: boolean; existing_id?: string; error?: string };
};

let teamCache: DirectoryTeam[] | null = null;
async function loadTeams(): Promise<DirectoryTeam[]> {
  if (teamCache) return teamCache;
  const { data } = await createClient().from("team_directory").select(TEAM_FIELDS).eq("hidden", false).order("name").limit(2000);
  teamCache = (data ?? []) as DirectoryTeam[];
  return teamCache;
}

const EXAMPLE = `Alabama vs Auburn, Sat 7:00 PM
Chiefs vs Bills, 11/30/2026 7:20 PM
Duke at UNC, 2026-12-05 18:00
Arsenal vs Chelsea, 12/06 11:30 AM, tie`;

const todayLocal = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function AdminBulkGames() {
  const zone = useZone();
  const realNow = useNow();
  // Read "now" on the wall clock of the chosen zone so words like "Sat 7pm" and "today" mean that zone.
  const now = realNow ? new Date(isoToWall(new Date(realNow).toISOString(), zone)).getTime() : 0;
  const [teams, setTeams] = useState<DirectoryTeam[]>(teamCache ?? []);
  const [slates, setSlates] = useState<{ id: string; title: string }[]>([]);
  const [slateId, setSlateId] = useState("");
  const [league, setLeague] = useState<"any" | "ncaa" | "nfl" | "nba" | "mlb">("any");
  const [text, setText] = useState("");
  const [defaultDate, setDefaultDate] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadTeams().then((t) => alive && setTeams(t));
    createClient()
      .from("pred_slates")
      .select("id, title")
      .eq("kind", "slate")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => alive && setSlates((data ?? []) as { id: string; title: string }[]));
    return () => { alive = false; };
  }, []);

  function enrich(r: BulkRow, lg = league): Row {
    const hc = matchTeams(teams, r.home, lg), ac = matchTeams(teams, r.away, lg);
    const home = hc.length === 1 ? hc[0] : null, away = ac.length === 1 ? ac[0] : null;
    return {
      ...r,
      home: home ? teamDisplayName(home) : r.home, away: away ? teamDisplayName(away) : r.away,
      homeLogo: teamLogo(home), awayLogo: teamLogo(away),
      homeCands: hc.length > 1 ? hc : [], awayCands: ac.length > 1 ? ac : [],
    };
  }

  const dd = defaultDate || todayLocal(now || 0);

  function loadRows(parsed: BulkRow[]) {
    setMsg(null);
    if (parsed.length === 0) { setMsg("Nothing to preview yet. Add at least one game."); return; }
    setRows(parsed.map((r) => enrich(r)));
  }

  function previewPaste() {
    loadRows(parsePaste(text, dd, now || 0));
  }

  async function onCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 500_000) { setMsg("That file is too large. Keep it under 500 KB."); return; }
    loadRows(rowsFromCsv(await f.text(), dd, now || 0));
  }

  function patch(key: string, p: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p, problem: undefined, result: r.result?.ok ? r.result : undefined } : r)));
  }
  function setName(key: string, side: "home" | "away", v: string) {
    const c = matchTeams(teams, v, league);
    const t = c.length === 1 && teamDisplayName(c[0]).toLowerCase() === v.trim().toLowerCase() ? c[0] : null;
    patch(key, side === "home" ? { home: v, homeLogo: teamLogo(t), homeCands: [] } : { away: v, awayLogo: teamLogo(t), awayCands: [] });
  }
  function choose(key: string, side: "home" | "away", teamId: string) {
    const r = rows.find((x) => x.key === key);
    const t = (side === "home" ? r?.homeCands : r?.awayCands)?.find((x) => x.id === teamId);
    if (!t) return;
    patch(key, side === "home" ? { home: teamDisplayName(t), homeLogo: teamLogo(t), homeCands: [] } : { away: teamDisplayName(t), awayLogo: teamLogo(t), awayCands: [] });
  }
  function remove(key: string) { setRows((rs) => rs.filter((r) => r.key !== key)); }

  const pending = rows.filter((r) => !r.result?.ok && !r.result?.duplicate);
  const ready = pending.filter((r) => r.home.trim() && r.away.trim() && r.when);
  const over = pending.length > BULK_MAX;

  async function create() {
    if (ready.length === 0 || over) return;
    setBusy(true);
    setMsg(null);
    const batch = ready;
    const { data, error } = await createClient().rpc("admin_bulk_create_pred_games", {
      p_games: batch.map((r) => ({
        home_name: r.home.trim(), away_name: r.away.trim(),
        home_logo: r.homeLogo || null, away_logo: r.awayLogo || null,
        starts_at: wallToIso(r.when, zone), allow_draw: r.tie,
      })),
      p_slate_id: slateId || null,
    });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    const out = data as { i: number; ok: boolean; id?: string; duplicate?: boolean; existing_id?: string; error?: string }[];
    const byKey = new Map(batch.map((r, idx) => [r.key, out.find((o) => o.i === idx + 1)]));
    setRows((rs) => rs.map((r) => (byKey.has(r.key) && byKey.get(r.key) ? { ...r, result: byKey.get(r.key) } : r)));
    const made = out.filter((o) => o.ok).length, dups = out.filter((o) => o.duplicate).length, bad = out.length - made - dups;
    setMsg(`${made} created${dups ? `, ${dups} already existed` : ""}${bad ? `, ${bad} need fixing` : ""}.`);
  }

  function template() {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "prediction-games-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const field = "mt-1 h-10 w-full rounded-lg border bg-transparent px-2.5 text-sm";
  const border = { borderColor: "var(--border)" };

  return (
    <div className="flex flex-col gap-5">
      <section className="bc-card p-4">
        <h3 className="mb-1 text-sm font-bold">1. Add your games</h3>
        <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
          One game per line: <b>Home vs Away, when</b>. Use <b>Away at Home</b> if you list the visitor first. Add <b>, tie</b> for sports that can end in a draw.
          Times can be <i>Sat 7pm</i>, <i>10/10 7:30 PM</i>, <i>2026-10-10 19:30</i>, or just <i>7:00 PM</i> to use the date below. Up to {BULK_MAX} per batch, in your local time.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder={EXAMPLE}
          aria-label="Games, one per line"
          className="w-full rounded-xl border bg-transparent p-3 font-mono text-xs"
          style={border}
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs font-bold">
            Times are in
            <span className="mt-1 block"><TimeZoneSelect className="h-11 w-full rounded-xl border bg-transparent px-3 text-sm" style={border} /></span>
          </label>
          <label className="block text-xs font-bold">
            Date for lines with only a time
            <input type="date" value={dd} onChange={(e) => setDefaultDate(e.target.value)} className={field} style={border} />
          </label>
          <label className="block text-xs font-bold">
            Team lookup
            <select value={league} onChange={(e) => setLeague(e.target.value as typeof league)} className={field} style={border}>
              <option value="any">Any league</option>
              {Object.entries(LEAGUE_LABEL).map(([k, v]) => <option key={k} value={k}>{v} only</option>)}
            </select>
          </label>
          <label className="block text-xs font-bold">
            Add to slate (optional)
            <select value={slateId} onChange={(e) => setSlateId(e.target.value)} className={field} style={border}>
              <option value="">Standalone games</option>
              {slates.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={previewPaste} className="bc-btn-solid rounded-full px-5 py-2 text-sm font-bold">Preview pasted games</button>
          <label className="cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold" style={border}>
            Upload CSV
            <input type="file" accept=".csv,text/csv" onChange={onCsv} className="sr-only" />
          </label>
          <button type="button" onClick={template} className="text-xs font-semibold underline" style={{ color: "var(--blue)" }}>Download CSV template</button>
        </div>
      </section>

      {msg && <p role="status" className="text-sm font-semibold" style={{ color: "var(--text-dim)" }}>{msg}</p>}

      {rows.length > 0 && (
        <section>
          <h3 className="mb-1 text-sm font-bold">2. Check and fix, then create</h3>
          <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
            Logos load automatically when a team is in the directory. Anything else is created with the name only; you can add a logo on the game afterward.
          </p>
          <div className="flex flex-col gap-3">
            {rows.map((r, idx) => {
              const done = r.result?.ok, dup = r.result?.duplicate;
              const warn = r.problem || r.result?.error;
              return (
                <div key={r.key} className="bc-card p-3" style={{ opacity: done || dup ? 0.75 : 1 }}>
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold">
                    <span style={{ color: "var(--text-faint)" }}>Game {idx + 1}</span>
                    {done ? (
                      <Link href={`/predictions/${r.result?.id}`} className="underline" style={{ color: "var(--blue)" }}>✓ Created, open it</Link>
                    ) : dup ? (
                      <Link href={`/predictions/${r.result?.existing_id}`} className="underline" style={{ color: "var(--red)" }}>Already exists, open it</Link>
                    ) : (
                      <button type="button" onClick={() => remove(r.key)} className="underline" style={{ color: "var(--text-dim)" }}>Remove</button>
                    )}
                  </div>
                  {warn && <p role="alert" className="mb-2 text-xs font-semibold" style={{ color: "var(--danger)" }}>{warn}</p>}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(["home", "away"] as const).map((side) => {
                      const val = side === "home" ? r.home : r.away, logo = side === "home" ? r.homeLogo : r.awayLogo;
                      const cands = side === "home" ? r.homeCands : r.awayCands;
                      return (
                        <label key={side} className="block text-xs font-bold">
                          {side === "home" ? "Home" : "Away"}
                          <span className="mt-1 flex items-center gap-2">
                            {logo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={logo} alt="" className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-1" />
                            ) : (
                              <span aria-hidden className="h-9 w-9 shrink-0 rounded-lg" style={{ background: "var(--surface-2)" }} />
                            )}
                            <input value={val} maxLength={40} disabled={!!done || !!dup} onChange={(e) => setName(r.key, side, e.target.value)} className="h-10 w-full min-w-0 rounded-lg border bg-transparent px-2.5 text-sm" style={border} />
                          </span>
                          {cands.length > 1 && (
                            <select aria-label={`Which ${val}?`} defaultValue="" onChange={(e) => choose(r.key, side, e.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-transparent px-2 text-xs" style={{ borderColor: "var(--red)" }}>
                              <option value="" disabled>Which one? ({cands.length} matches)</option>
                              {cands.map((t) => <option key={t.id} value={t.id}>{LEAGUE_LABEL[t.league as keyof typeof LEAGUE_LABEL]} · {t.full_name}</option>)}
                            </select>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <label className="block text-xs font-bold">
                      Starts
                      <input type="datetime-local" value={r.when} disabled={!!done || !!dup} onChange={(e) => patch(r.key, { when: e.target.value })} className={`${field} w-56`} style={border} />
                    </label>
                    <label className="flex h-10 items-center gap-2 text-sm font-semibold">
                      <input type="checkbox" checked={r.tie} disabled={!!done || !!dup} onChange={(e) => patch(r.key, { tie: e.target.checked })} className="h-4 w-4" />
                      Can end in a tie
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          {over && <p role="alert" className="mt-3 text-sm font-semibold" style={{ color: "var(--danger)" }}>Up to {BULK_MAX} games per batch. Remove {pending.length - BULK_MAX} to continue.</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={create} disabled={busy || ready.length === 0 || over} className="bc-btn-solid rounded-full px-6 py-3 text-sm font-bold disabled:opacity-50">
              {busy ? "Creating…" : `Create ${ready.length} game${ready.length === 1 ? "" : "s"}`}
            </button>
            {ready.length < pending.length && <span className="text-xs" style={{ color: "var(--text-faint)" }}>{pending.length - ready.length} row{pending.length - ready.length === 1 ? "" : "s"} still need a team name or time.</span>}
          </div>
        </section>
      )}
    </div>
  );
}
