import { absoluteLogo, searchTeams, type DirectoryTeam, type TeamLeague } from "@/lib/teams/directory";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

/** Same naming the Pick-a-team dropdown uses: school name for NCAA, full name for pro teams. */
export function teamDisplayName(t: DirectoryTeam): string {
  return (t.league === "ncaa" ? t.name : t.full_name).slice(0, 40);
}

export function teamLogo(t: DirectoryTeam | null | undefined): string {
  return t ? absoluteLogo(t.logo_url) : "";
}

/**
 * Finds directory teams for typed text. Exact matches on name, full name or abbreviation win;
 * otherwise a single unambiguous search hit is used. More than one result means "ambiguous"
 * (for example Washington is both an NCAA school and an NFL team) and the admin picks.
 */
export function matchTeams(teams: DirectoryTeam[], text: string, league: TeamLeague | "any" = "any"): DirectoryTeam[] {
  const q = norm(text);
  if (!q) return [];
  const pool = league === "any" || league === "custom" ? teams : teams.filter((t) => t.league === league);
  const exact = pool.filter((t) => norm(t.name) === q || norm(t.full_name) === q || (t.abbr && norm(t.abbr) === q));
  if (exact.length) return exact;
  const found = searchTeams(pool, text, 3);
  if (found.length === 1) return found;
  const prefix = found.filter((t) => norm(t.name).startsWith(q) || norm(t.full_name).startsWith(q));
  return prefix.length === 1 ? prefix : [];
}
