"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LogoUploadField from "@/components/LogoUploadField";
import { LEAGUE_LABEL, ADMIN_TEAM_FIELDS, searchTeams, type DirectoryTeam, type TeamLeague } from "@/lib/teams/directory";

type Seed = Omit<DirectoryTeam, "id" | "hidden">;

export default function AdminTeamsManager({ initial }: { initial: DirectoryTeam[] }) {
  const sb = createClient();
  const [teams, setTeams] = useState(initial);
  const [league, setLeague] = useState<TeamLeague>("ncaa");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<DirectoryTeam | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", logo: "", conference: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of teams) c[t.league] = (c[t.league] ?? 0) + 1;
    return c;
  }, [teams]);
  const shown = searchTeams(teams.filter((t) => t.league === league), q, 400);

  async function reload() {
    const { data } = await sb.from("team_directory").select(ADMIN_TEAM_FIELDS).order("league").order("name").limit(2000);
    setTeams((data ?? []) as DirectoryTeam[]);
  }

  async function importSeed() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/team-logos/teams.json", { cache: "no-store" });
      const seed = (await res.json()) as Seed[];
      // Only adds teams that are not there yet: edits and hidden flags are kept.
      const have = new Set(teams.map((t) => `${t.league}:${t.ext_id}`));
      const fresh = seed.filter((s) => !have.has(`${s.league}:${s.ext_id}`));
      for (let i = 0; i < fresh.length; i += 100) {
        const { error } = await sb.from("team_directory").insert(fresh.slice(i, i + 100));
        if (error) throw new Error(error.message);
      }
      await reload();
      setMsg(fresh.length ? `Added ${fresh.length} teams.` : "Everything is already imported.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Import failed.");
    }
    setBusy(false);
  }

  async function toggleHidden(t: DirectoryTeam) {
    const { error } = await sb.from("team_directory").update({ hidden: !t.hidden }).eq("id", t.id);
    if (error) return setMsg(error.message);
    setTeams((p) => p.map((x) => (x.id === t.id ? { ...x, hidden: !t.hidden } : x)));
  }

  async function saveEdit() {
    if (!editing) return;
    const { error } = await sb.from("team_directory").update({ name: editing.name.trim(), full_name: editing.full_name.trim(), conference: editing.conference || null, logo_url: editing.logo_url || null, instagram_handle: editing.instagram_handle?.trim().replace(/^@/, "") || null, facebook_page: editing.facebook_page?.trim() || null }).eq("id", editing.id);
    if (error) return setMsg(error.message);
    setTeams((p) => p.map((x) => (x.id === editing.id ? editing : x)));
    setEditing(null);
    setMsg("Saved.");
  }

  async function addTeam() {
    const name = draft.name.trim();
    if (!name) return setMsg("Enter a team name.");
    const { data, error } = await sb.from("team_directory").insert({
      league, ext_id: `c-${crypto.randomUUID().slice(0, 8)}`, name, full_name: name,
      conference: draft.conference.trim() || null, logo_url: draft.logo || null,
    }).select(ADMIN_TEAM_FIELDS).single();
    if (error) return setMsg(error.message);
    setTeams((p) => [...p, data as DirectoryTeam]);
    setDraft({ name: "", logo: "", conference: "" });
    setAdding(false);
    setMsg("Team added.");
  }

  const border = { borderColor: "var(--border)" };
  const input = "w-full rounded-[10px] border px-3 py-2 text-sm";
  const leagues = [...(Object.keys(LEAGUE_LABEL) as (keyof typeof LEAGUE_LABEL)[]), "custom" as const];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={importSeed} disabled={busy} className="bc-btn-solid rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60">
          {busy ? "Importing…" : teams.length ? "Add any missing teams" : "Import NCAA, NFL, NBA & MLB teams"}
        </button>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>{teams.length} teams in the directory</span>
      </div>
      {msg && <p role="status" className="mb-3 text-sm font-semibold" style={{ color: "var(--text-dim)" }}>{msg}</p>}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {leagues.map((l) => (
          <button key={l} type="button" onClick={() => setLeague(l)} className="rounded-full px-3 py-1 text-xs font-bold" style={league === l ? { background: "var(--blue)", color: "#fff" } : { background: "var(--surface-2)", color: "var(--text-dim)" }}>
            {l === "custom" ? "Custom" : LEAGUE_LABEL[l]} ({counts[l] ?? 0})
          </button>
        ))}
      </div>
      <div className="mb-3 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search teams" className={input} style={border} />
        <button type="button" onClick={() => setAdding((a) => !a)} className="shrink-0 rounded-full border px-4 py-2 text-sm font-bold" style={border}>+ Add team</button>
      </div>

      {adding && (
        <div className="bc-card mb-4 grid gap-2 p-4">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>New team in {league === "custom" ? "Custom" : LEAGUE_LABEL[league]}</p>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Team name" maxLength={40} className={input} style={border} />
          <input value={draft.conference} onChange={(e) => setDraft({ ...draft, conference: e.target.value })} placeholder="Conference or group (optional)" maxLength={60} className={input} style={border} />
          <LogoUploadField value={draft.logo} onChange={(u) => setDraft({ ...draft, logo: u })} folder="teams" compact />
          <button type="button" onClick={addTeam} className="bc-btn-solid rounded-full px-4 py-2 text-sm font-bold">Add team</button>
        </div>
      )}

      <ul className="grid gap-1.5">
        {shown.length === 0 && <li className="text-sm" style={{ color: "var(--text-faint)" }}>{teams.length ? "No teams match." : "The directory is empty. Tap Import to load it."}</li>}
        {shown.map((t) => (
          <li key={t.id} className="bc-card flex items-center gap-3 p-2.5" style={t.hidden ? { opacity: 0.55 } : undefined}>
            {t.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.logo_url} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 shrink-0 object-contain" />
            ) : <span className="h-9 w-9 shrink-0 rounded bg-[var(--surface-2)]" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{t.full_name}{t.hidden ? " (hidden)" : ""}</p>
              <p className="truncate text-[11px]" style={{ color: "var(--text-faint)" }}>{t.conference ?? "-"}{t.abbr ? ` · ${t.abbr}` : ""}</p>
            </div>
            <button type="button" onClick={() => setEditing(t)} className="text-xs font-bold underline" style={{ color: "var(--blue)" }}>Edit</button>
            <button type="button" onClick={() => toggleHidden(t)} className="text-xs font-semibold" style={{ color: "var(--text-faint)" }}>{t.hidden ? "Show" : "Hide"}</button>
          </li>
        ))}
      </ul>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={`Edit ${editing.full_name}`}>
          <div className="bc-card grid w-full max-w-md gap-2 p-5" style={{ background: "var(--bg)" }}>
            <h3 className="text-lg font-bold">Edit team</h3>
            <label className="text-xs font-bold">Name used in forms
              <input value={editing.name} maxLength={40} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={input} style={border} />
            </label>
            <label className="text-xs font-bold">Full name
              <input value={editing.full_name} maxLength={60} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} className={input} style={border} />
            </label>
            <label className="text-xs font-bold">Conference
              <input value={editing.conference ?? ""} maxLength={60} onChange={(e) => setEditing({ ...editing, conference: e.target.value })} className={input} style={border} />
            </label>
            <label className="text-xs font-bold">Instagram handle (for social tags)
              <input value={editing.instagram_handle ?? ""} maxLength={40} placeholder="@school" onChange={(e) => setEditing({ ...editing, instagram_handle: e.target.value })} className={input} style={border} />
            </label>
            <label className="text-xs font-bold">Facebook Page name
              <input value={editing.facebook_page ?? ""} maxLength={80} onChange={(e) => setEditing({ ...editing, facebook_page: e.target.value })} className={input} style={border} />
            </label>
            <LogoUploadField value={editing.logo_url ?? ""} onChange={(u) => setEditing({ ...editing, logo_url: u })} folder="teams" compact />
            <div className="mt-1 flex gap-2">
              <button type="button" onClick={saveEdit} className="bc-btn-solid flex-1 rounded-full px-4 py-2 text-sm font-bold">Save</button>
              <button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-full border px-4 py-2 text-sm font-semibold" style={border}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
