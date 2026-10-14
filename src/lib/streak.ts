// A stored streak only counts while it is alive: played today or yesterday (UTC days, matching the database).
// Anything older has lapsed, even though the column still holds the old number until the next play.
function utcDay(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD in UTC
}

export function effectiveStreak(current: number | null | undefined, lastPlayed: string | null | undefined): number {
  if (!current || !lastPlayed) return 0;
  return lastPlayed >= utcDay(-1) ? current : 0;
}

/** True when the streak is alive but today's play hasn't happened yet. */
export function streakAtRisk(current: number | null | undefined, lastPlayed: string | null | undefined): boolean {
  return effectiveStreak(current, lastPlayed) > 0 && lastPlayed === utcDay(-1);
}
