// Team directory: NCAA Division I, NFL, NBA and MLB teams with their logos.
// Rows live in the public.team_directory table; logos are served from /team-logos.

export type TeamLeague = "ncaa" | "nfl" | "nba" | "mlb" | "custom";

export type DirectoryTeam = {
  id: string;
  league: TeamLeague;
  ext_id: string;
  name: string;
  full_name: string;
  abbr: string | null;
  conference: string | null;
  color: string | null;
  logo_url: string | null;
  hidden: boolean;
};

export const LEAGUE_LABEL: Record<Exclude<TeamLeague, "custom">, string> = {
  ncaa: "NCAA",
  nfl: "NFL",
  nba: "NBA",
  mlb: "MLB",
};

export const TEAM_FIELDS = "id, league, ext_id, name, full_name, abbr, conference, color, logo_url, hidden";

/** Makes a stored logo path usable everywhere (graphics, emails, other pages). */
export function absoluteLogo(url: string | null | undefined, origin?: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "");

/** Simple ranked search over name, full name, abbreviation and conference. */
export function searchTeams(teams: DirectoryTeam[], query: string, limit = 60): DirectoryTeam[] {
  const q = norm(query.trim());
  if (!q) return teams.slice(0, limit);
  const scored: [number, DirectoryTeam][] = [];
  for (const t of teams) {
    const name = norm(t.name), full = norm(t.full_name), abbr = norm(t.abbr ?? ""), conf = norm(t.conference ?? "");
    let s = 0;
    if (abbr === q) s = 100;
    else if (name.startsWith(q)) s = 90;
    else if (full.startsWith(q)) s = 80;
    else if (name.includes(q)) s = 60;
    else if (full.includes(q)) s = 50;
    else if (conf.includes(q)) s = 20;
    if (s) scored.push([s, t]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name));
  return scored.slice(0, limit).map((x) => x[1]);
}
