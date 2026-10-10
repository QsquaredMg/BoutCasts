import { matchTeams } from "@/lib/teams/match";
import type { DirectoryTeam, TeamLeague } from "@/lib/teams/directory";

// Looks up the final score of a game on ESPN's public scoreboard. Team ids in the
// BoutCasts team directory are ESPN team ids, so a game is matched by its two teams
// and the day it started, then only trusted once ESPN marks it completed.

type Feed = { path: string; groups?: string };
const FEEDS: Record<Exclude<TeamLeague, "custom">, Feed[]> = {
  nfl: [{ path: "football/nfl" }],
  nba: [{ path: "basketball/nba" }],
  mlb: [{ path: "baseball/mlb" }],
  ncaa: [
    { path: "football/college-football", groups: "80" },
    { path: "football/college-football", groups: "81" },
    { path: "basketball/mens-college-basketball", groups: "50" },
    { path: "basketball/womens-college-basketball", groups: "50" },
  ],
};

export type GameForScore = { home_name: string; away_name: string; starts_at: string };
export type FoundScore = { home: number; away: number; source: string };
export type ScoreLookup = { ok: true; score: FoundScore } | { ok: false; reason: string };

const etDay = (iso: string) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  return p.replace(/-/g, "");
};

type EspnEvent = {
  status?: { type?: { completed?: boolean; name?: string } };
  competitions?: { competitors?: { id?: string; team?: { id?: string }; score?: string }[] }[];
};

async function scoreboard(feed: Feed, day: string): Promise<EspnEvent[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${feed.path}/scoreboard?dates=${day}&limit=400${feed.groups ? `&groups=${feed.groups}` : ""}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!res.ok) return [];
  const json = (await res.json().catch(() => null)) as { events?: EspnEvent[] } | null;
  return json?.events ?? [];
}

export async function lookupFinalScore(game: GameForScore, directory: DirectoryTeam[]): Promise<ScoreLookup> {
  const day = etDay(game.starts_at);
  let sawGame = false;
  for (const league of ["nfl", "nba", "mlb", "ncaa"] as const) {
    const home = matchTeams(directory, game.home_name, league);
    const away = matchTeams(directory, game.away_name, league);
    if (home.length !== 1 || away.length !== 1) continue;
    const [h, a] = [home[0].ext_id, away[0].ext_id];
    for (const feed of FEEDS[league]) {
      let events: EspnEvent[] = [];
      try {
        events = await scoreboard(feed, day);
      } catch {
        continue;
      }
      for (const ev of events) {
        const comps = ev.competitions?.[0]?.competitors ?? [];
        const ids = comps.map((c) => c.team?.id ?? c.id);
        if (!ids.includes(h) || !ids.includes(a)) continue;
        sawGame = true;
        if (!ev.status?.type?.completed) return { ok: false, reason: "The game isn't finished yet on the scoreboard." };
        const sc = (id: string) => Number(comps.find((c) => (c.team?.id ?? c.id) === id)?.score);
        const [hs, as] = [sc(h), sc(a)];
        if (!Number.isFinite(hs) || !Number.isFinite(as)) return { ok: false, reason: "The scoreboard has no score for this game." };
        return { ok: true, score: { home: hs, away: as, source: `ESPN ${feed.path}` } };
      }
    }
  }
  return { ok: false, reason: sawGame ? "Couldn't read the score." : "Couldn't find this game on the scoreboard (team names may not match the directory)." };
}
