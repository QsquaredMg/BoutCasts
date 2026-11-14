import { isLocked, lockAtMs, type PredGame } from "./types";

/**
 * Share captions for prediction pages. Written to get people making picks:
 * the challenge and the deadline come first (Facebook cuts a post after about two
 * lines), there is one action, and it ends on the call to action so the link
 * that networks append lands right after it.
 *
 * Picks lock at a different clock time for every viewer, so the caption carries a
 * LOCK_TOKEN. ShareButton swaps it for the sharer's local time when they tap share.
 */
export const LOCK_TOKEN = "{lock}";

type GameForCaption = Pick<PredGame, "home_name" | "away_name" | "starts_at" | "status" | "home_score" | "away_score" | "round">;

/**
 * `bracketLocksAtIso` is the bracket's own lock time. Games in a bracket (round !== null) don't lock
 * at their own start: every bracket pick locks at once, so never advertise the game's start + grace.
 */
export function gameShareCaption(g: GameForCaption, bracketLocksAtIso?: string | null): { text: string; lockAtIso?: string } {
  if (g.status === "final" && g.home_score != null && g.away_score != null) {
    return {
      text: `Final: ${g.home_name} ${g.home_score}, ${g.away_name} ${g.away_score}. 🔥 Did you call it? Beat the leaderboard on the next one. 👉 See how the picks landed:`,
    };
  }
  if (g.round !== null) {
    const open = g.status === "scheduled" && (!bracketLocksAtIso || new Date(bracketLocksAtIso).getTime() > Date.now());
    if (!open) return { text: `${g.home_name} vs ${g.away_name} is underway. 🏆 Get your picks in on the next one. 👉 Join the game:` };
    return bracketLocksAtIso
      ? { text: `🏆 ${g.home_name} vs ${g.away_name}: think you can beat me? Fill out your bracket before the bell. Picks lock ${LOCK_TOKEN}. 👉 Lock in your picks:`, lockAtIso: bracketLocksAtIso }
      : { text: `🏆 ${g.home_name} vs ${g.away_name}: think you can beat me? Fill out your bracket and climb the leaderboard. 👉 Lock in your picks:` };
  }
  if (isLocked(g)) {
    return { text: `${g.home_name} vs ${g.away_name} is underway. 🥊 Get your picks in on the next one. 👉 Join the game:` };
  }
  return {
    text: `🥊 ${g.home_name} vs ${g.away_name}: who wins, and by how much? Think you can beat me? Make your call before the first bell. Picks lock ${LOCK_TOKEN}. 👉 Call it before the bell:`,
    lockAtIso: new Date(lockAtMs(g)).toISOString(),
  };
}

export function slateShareCaption(title: string, locksAtIso: string | null): { text: string; lockAtIso?: string } {
  if (locksAtIso) {
    return {
      text: `🏆 ${title}: think you can beat me? Make your picks before the bell. Picks lock ${LOCK_TOKEN}. 👉 Lock in your picks:`,
      lockAtIso: locksAtIso,
    };
  }
  return { text: `🏆 ${title}: think you can beat me? Make your picks and climb the leaderboard. 👉 Lock in your picks:` };
}

/** "Sat 7:00 PM" within the coming week, "Sat, Nov 21, 7:00 PM" further out. Uses the viewer's own locale and time zone. */
export function formatLock(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "soon";
  const soon = d.getTime() - now < 6 * 24 * 3600 * 1000;
  return d.toLocaleString(undefined, soon
    ? { weekday: "short", hour: "numeric", minute: "2-digit" }
    : { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
