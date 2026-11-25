import { SITE, type GameScore } from "./types";

const line = (g: GameScore) => `${g.away} ${g.as}, ${g.home} ${g.hs}`;
const margin = (g: GameScore) => Math.abs(g.as - g.hs);
const winnerOf = (g: GameScore) => (g.as === g.hs ? null : g.as > g.hs ? g.away : g.home);

type Caps = { facebook: string; instagram: string };

/** Short caption for a single finished game. */
export function gameResultCaptions(g: GameScore, path: string): Caps {
  const w = winnerOf(g);
  const head = `🏁 FINAL: ${g.away} ${g.as}, ${g.home} ${g.hs}`;
  const story = w ? `${w} takes it by ${margin(g)}.` : "All square at the final whistle.";
  const ask = "Did you call it? See how your picks scored 👇";
  return {
    facebook: [head, "", story, "", ask, `${SITE}${path}`].join("\n"),
    instagram: [head, "", story, "", ask.replace(" 👇", ""), "Link in bio 🔗 boutcasts.com"].join("\n"),
  };
}

/** Brief write-up plus the full scoreboard for a day on which every scheduled game is final. */
export function dailyResultsCaptions(label: string, games: GameScore[], path: string): Caps {
  const n = games.length;
  const decided = games.filter((g) => g.as !== g.hs);
  const homeWins = decided.filter((g) => g.hs > g.as).length;
  const closest = [...decided].sort((a, b) => margin(a) - margin(b))[0];
  const blowout = [...decided].sort((a, b) => margin(b) - margin(a))[0];
  const shootout = [...games].sort((a, b) => b.as + b.hs - (a.as + a.hs))[0];

  const bits: string[] = [`${n} games are final on ${label}.`];
  if (decided.length) bits.push(`Home teams went ${homeWins}-${decided.length - homeWins}.`);
  if (closest) bits.push(`Closest finish: ${winnerOf(closest)} by ${margin(closest)} (${line(closest)}).`);
  if (blowout && blowout !== closest && margin(blowout) > margin(closest)) bits.push(`Biggest margin: ${winnerOf(blowout)} by ${margin(blowout)}.`);
  if (shootout && shootout !== closest && shootout !== blowout) bits.push(`Most points: ${line(shootout)}.`);
  const writeup = bits.join(" ");

  const shown = games.slice(0, 15);
  const scores = shown.map((g) => `• ${line(g)}`);
  if (games.length > shown.length) scores.push(`…and ${games.length - shown.length} more`);
  const head = `📋 FINAL SCORES · ${label}`;
  const ask = "Check how your picks scored 👇";
  return {
    facebook: [head, "", writeup, "", ...scores, "", ask, `${SITE}${path}`].join("\n"),
    instagram: [head, "", writeup, "", ...scores, "", ask.replace(" 👇", ""), "Link in bio 🔗 boutcasts.com"].join("\n").slice(0, 2000),
  };
}
