// Time zone helpers shared by every module that picks or shows a time.
// Rule: a time is always stored as an exact moment (UTC ISO). The zone only decides how a
// typed "wall clock" time is read and how a stored moment is shown.

export type Zone = { id: string; label: string; abbr: string };

export const ZONES: Zone[] = [
  { id: "America/New_York", label: "Eastern", abbr: "ET" },
  { id: "America/Chicago", label: "Central", abbr: "CT" },
  { id: "America/Denver", label: "Mountain", abbr: "MT" },
  { id: "America/Phoenix", label: "Arizona (no daylight time)", abbr: "MST" },
  { id: "America/Los_Angeles", label: "Pacific", abbr: "PT" },
  { id: "America/Anchorage", label: "Alaska", abbr: "AKT" },
  { id: "Pacific/Honolulu", label: "Hawaii", abbr: "HT" },
  { id: "UTC", label: "UTC", abbr: "UTC" },
];

export const DEFAULT_ZONE = "America/Chicago";

export function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_ZONE;
  } catch {
    return DEFAULT_ZONE;
  }
}

export function isValidZone(id: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: id });
    return true;
  } catch {
    return false;
  }
}

const WALL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

function partsIn(ms: number, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(ms))) if (p.type !== "literal") o[p.type] = Number(p.value);
  return o;
}

// How far the zone's wall clock is ahead of UTC at a given instant, in ms.
function offsetMs(ms: number, tz: string) {
  const p = partsIn(ms, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour === 24 ? 0 : p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

/** "2026-10-10T19:00" typed in `tz` → the exact moment (ms). NaN when the text is not a date. */
export function wallToMs(wall: string, tz: string): number {
  const m = WALL.exec(wall);
  if (!m) return NaN;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let t = guess - offsetMs(guess, tz);
  const again = guess - offsetMs(t, tz); // settles the daylight-time edge
  if (again !== t) t = again;
  return t;
}

export function wallToIso(wall: string, tz: string): string {
  const ms = wallToMs(wall, tz);
  return Number.isNaN(ms) ? "" : new Date(ms).toISOString();
}

/** A stored moment → "2026-10-10T19:00" as read on the wall clock in `tz`. */
export function isoToWall(iso: string, tz: string): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const p = partsIn(ms, tz);
  const z = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${z(p.year, 4)}-${z(p.month)}-${z(p.day)}T${z(p.hour === 24 ? 0 : p.hour)}:${z(p.minute)}`;
}

export function zoneAbbr(ms: number, tz: string): string {
  const known = ZONES.find((z) => z.id === tz);
  if (known) return known.abbr;
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date(ms)).find((p) => p.type === "timeZoneName");
    return part?.value ?? tz;
  } catch {
    return tz;
  }
}

export function zoneName(tz: string): string {
  const known = ZONES.find((z) => z.id === tz);
  return known ? `${known.label} (${known.abbr})` : tz.replace(/_/g, " ");
}

export type WhenOpts = { withDate?: boolean; withYear?: boolean; weekday?: boolean };

/** "Sat, Oct 10, 7:00 PM CT" */
export function formatWhen(iso: string | number | Date, tz: string, o: WhenOpts = {}): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const { withDate = true, withYear = false, weekday = true } = o;
  const base = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: weekday ? "short" : undefined,
    month: withDate ? "short" : undefined,
    day: withDate ? "numeric" : undefined,
    year: withYear ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
  return `${base} ${zoneAbbr(ms, tz)}`;
}
