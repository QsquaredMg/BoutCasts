import { SITE } from "./types";

const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: cents % 100 ? 2 : 0 })}`;
export const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET" : null;

type Parts = { fbLink: string; igLink: string };
const links = (path: string): Parts => ({ fbLink: `${SITE}${path}`, igLink: "Link in bio 🔗 boutcasts.com" });

export function boutLaunch(b: { a: string; b: string; closes_at: string | null; prize: string | null; path: string }) {
  const { fbLink, igLink } = links(b.path);
  const close = when(b.closes_at);
  const make = (link: string) =>
    [
      `🔥 NEW BOUT LIVE: ${b.a} vs ${b.b}`,
      "",
      "Who takes it? You decide 👇",
      `🅰️ ${b.a}`,
      `🅱️ ${b.b}`,
      b.prize ? `\n🎁 ${b.prize}` : "",
      "",
      `🗳️ Cast your vote${close ? ` before ${close}` : " now"}: ${link}`,
      "💬 Drop your pick in the comments: A or B?",
      "🔁 Tag a friend who needs to see this one.",
    ].filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n");
  return { facebook: make(fbLink), instagram: make(igLink) };
}

export function paidBoutLaunch(b: { title: string; feeCents: number; poolCents: number; prizes: { place: number; cents: number }[]; deadline: string; spotsLeft: number | null; path: string }) {
  const { fbLink, igLink } = links(b.path);
  const ord = ["🥇 1st", "🥈 2nd", "🥉 3rd"];
  const make = (link: string) =>
    [
      `💰 ${b.poolCents ? `${money(b.poolCents)} PRIZE POOL` : "NEW PAID BOUT"}: ${b.title}`,
      "",
      `Entry is just ${money(b.feeCents)}. Show what you've got and win.`,
      ...b.prizes.slice(0, 3).map((p) => `${ord[p.place - 1] ?? `#${p.place}`}: ${money(p.cents)}`),
      "",
      `⏳ Entries close ${when(b.deadline)}${b.spotsLeft !== null && b.spotsLeft <= 20 ? ` · only ${b.spotsLeft} spot${b.spotsLeft === 1 ? "" : "s"} left` : ""}`,
      `👉 Enter now: ${link}`,
      "🔁 Know someone who'd win this? Tag them below.",
      "Full rules and payout terms on the entry page.",
    ].join("\n");
  return { facebook: make(fbLink), instagram: make(igLink) };
}

// ---- Prediction games and brackets -------------------------------------------------------------------

export type LaunchGame = { home: string; away: string; startsAt: string | null };

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET" : "TBA";

/** Same post, same hook, every time it is regenerated, but different posts rotate through the hooks. */
const pick = <T,>(list: T[], seed: string): T => {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
};

const MAX_LINES = 5;
const matchLines = (games: LaunchGame[], total: number) => {
  const shown = games.slice(0, MAX_LINES).map((g) => `• ${g.away} vs ${g.home}${g.startsAt ? ` · ${day(g.startsAt)}` : ""}`);
  if (total > shown.length) shown.push(`+ ${total - shown.length} more game${total - shown.length === 1 ? "" : "s"} inside`);
  return shown;
};

const squash = (lines: string[]) => lines.filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n");

/** A new public pick'em: a handful of games on one leaderboard. */
export function predictionsLaunch(g: { id: string; title: string; games: LaunchGame[]; total: number; firstLock: string | null; path: string }) {
  const { fbLink, igLink } = links(g.path);
  const hook = pick(
    [
      `🔮 Think you know ball? Prove it. ${g.title} is OPEN.`,
      `🔥 PICK'EM IS LIVE: ${g.title}`,
      `👀 Who's got the better eye? ${g.title} is open for picks.`,
    ],
    g.id,
  );
  const make = (link: string) =>
    squash([
      hook,
      "",
      ...matchLines(g.games, g.total),
      "",
      "🎯 Free to play. Call the winners, climb the leaderboard, earn the bragging rights.",
      g.firstLock ? `⏳ First picks lock ${when(g.firstLock)}` : "",
      `👉 Make your picks: ${link}`,
      "💬 Tell us your boldest pick in the comments 👇",
      "🔁 Tag the friend who always thinks they're right.",
    ]);
  return { facebook: make(fbLink), instagram: make(igLink) };
}

/** A new elimination bracket (prediction or head-to-head). */
export function bracketLaunch(g: { id: string; title: string; teams: number | null; games: LaunchGame[]; firstLock: string | null; path: string; mode?: "picks" | "votes" }) {
  const { fbLink, igLink } = links(g.path);
  const votes = g.mode === "votes";
  const size = g.teams ? `${g.teams}-team` : "New";
  const hook = pick(
    [
      `🏆 ${size} BRACKET IS OPEN: ${g.title}`,
      `🧠 Think you can call the whole bracket? ${g.title} is open.`,
      `🔥 Bracket season: ${g.title}. One perfect run takes the crown.`,
    ],
    g.id,
  );
  const make = (link: string) =>
    squash([
      hook,
      "",
      ...matchLines(g.games, g.games.length),
      "",
      votes
        ? "🗳️ Every round is decided by YOUR vote. Back your favorites and help crown the champion."
        : "🎯 Free to play. Pick every round, watch your bracket survive (or bust), and chase the top of the board.",
      !votes && g.firstLock ? `⏳ Round 1 picks lock ${when(g.firstLock)}` : "",
      votes ? `👉 Cast your votes: ${link}` : `👉 Fill out your bracket: ${link}`,
      "💬 Who's your champion? Drop it below 👇",
      votes ? "🔁 Tag a friend who needs to vote in this one." : "🔁 Send this to the friend who busts their bracket in round one.",
    ]);
  return { facebook: make(fbLink), instagram: make(igLink) };
}
