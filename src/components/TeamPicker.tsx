"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LEAGUE_LABEL, TEAM_FIELDS, absoluteLogo, searchTeams, type DirectoryTeam, type TeamLeague } from "@/lib/teams/directory";

// "Pick a team" dropdown for NCAA / NFL / NBA / MLB. Choosing a team hands back its
// name and logo so the form can preload them; typing a name manually still works.

let cache: DirectoryTeam[] | null = null;
let inflight: Promise<DirectoryTeam[]> | null = null;

function loadTeams(): Promise<DirectoryTeam[]> {
  if (cache) return Promise.resolve(cache);
  inflight ??= (async () => {
    const { data } = await createClient().from("team_directory").select(TEAM_FIELDS).eq("hidden", false).order("name").limit(2000);
    cache = (data ?? []) as DirectoryTeam[];
    return cache;
  })();
  return inflight;
}

export type PickedTeam = { name: string; logo: string; teamId: string };

export default function TeamPicker({
  onPick,
  label = "Pick a team",
  nameMode = "short",
}: {
  onPick: (team: PickedTeam) => void;
  label?: string;
  /** "short" = school/city name (Alabama); "full" = with mascot (Alabama Crimson Tide). */
  nameMode?: "short" | "full";
}) {
  const [open, setOpen] = useState(false);
  const [league, setLeague] = useState<Exclude<TeamLeague, "custom">>("ncaa");
  const [q, setQ] = useState("");
  const [teams, setTeams] = useState<DirectoryTeam[] | null>(cache);

  useEffect(() => {
    if (!open || teams) return;
    let alive = true;
    loadTeams().then((t) => alive && setTeams(t));
    return () => { alive = false; };
  }, [open, teams]);

  const inLeague = (teams ?? []).filter((t) => t.league === league);
  const results = searchTeams(inLeague, q);

  function choose(t: DirectoryTeam) {
    onPick({
      name: (nameMode === "full" ? t.full_name : t.league === "ncaa" ? t.name : t.full_name).slice(0, 40),
      logo: absoluteLogo(t.logo_url),
      teamId: t.id,
    });
    setOpen(false);
    setQ("");
  }

  const border = { borderColor: "var(--border)" };
  return (
    <div className="mb-2">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="rounded-full border px-3 py-1.5 text-xs font-bold" style={{ ...border, color: "var(--blue)" }}>
        {open ? "Close team list" : `🏟️ ${label}`}
      </button>
      {open && (
        <div className="mt-2 rounded-xl border p-3" style={{ ...border, background: "var(--surface)" }}>
          <div className="mb-2 flex flex-wrap gap-1.5" role="tablist" aria-label="League">
            {(Object.keys(LEAGUE_LABEL) as (keyof typeof LEAGUE_LABEL)[]).map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={league === l}
                onClick={() => setLeague(l)}
                className="rounded-full px-3 py-1 text-xs font-bold"
                style={league === l ? { background: "var(--blue)", color: "#fff" } : { background: "var(--surface-2)", color: "var(--text-dim)" }}
              >
                {LEAGUE_LABEL[l]}
              </button>
            ))}
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={league === "ncaa" ? "Search school, mascot or conference" : "Search team"}
            aria-label="Search teams"
            className="mb-2 w-full rounded-[10px] border px-3 py-2 text-sm"
            style={border}
          />
          <ul className="max-h-64 overflow-y-auto" role="listbox" aria-label="Teams">
            {!teams && <li className="p-2 text-sm" style={{ color: "var(--text-faint)" }}>Loading teams…</li>}
            {teams && results.length === 0 && <li className="p-2 text-sm" style={{ color: "var(--text-faint)" }}>No match. Type the team name in the box below instead.</li>}
            {results.map((t) => (
              <li key={t.id}>
                <button type="button" role="option" aria-selected={false} onClick={() => choose(t)} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--surface-2)]">
                  {t.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.logo_url} alt="" width={32} height={32} loading="lazy" className="h-8 w-8 shrink-0 object-contain" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{t.full_name}</span>
                    {t.conference && <span className="block truncate text-[11px]" style={{ color: "var(--text-faint)" }}>{t.conference}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>Don&apos;t see yours? Close this and type the name and upload a logo yourself.</p>
        </div>
      )}
    </div>
  );
}
