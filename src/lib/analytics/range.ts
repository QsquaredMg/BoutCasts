// Date-range handling for the admin Analytics pages. Days are Chicago days so
// "today" matches the clock the admin lives by; all windows are [from, to).

const TZ = "America/Chicago";

export const PRESETS = [
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
] as const;

export type RangeParams = { range?: string; from?: string; to?: string; compare?: string };

export type Range = {
  key: string;
  label: string;
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  compare: boolean;
  fromDay: string;
  toDay: string;
};

function chicagoHour(ms: number): number {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(new Date(ms));
  return Number(h) % 24;
}

/** The instant of 00:00 Chicago time on the given calendar day (month is 0-based). */
function chicagoMidnight(y: number, m0: number, d: number): number {
  for (const off of [5, 6]) {
    const t = Date.UTC(y, m0, d, off);
    if (chicagoHour(t) === 0) return t;
  }
  return Date.UTC(y, m0, d, 6);
}

function chicagoToday(nowMs: number): { y: number; m0: number; d: number } {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(nowMs)); // YYYY-MM-DD
  const [y, m, d] = s.split("-").map(Number);
  return { y, m0: m - 1, d };
}

function dayString(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(ms));
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function resolveRange(sp: RangeParams): Range {
  const nowMs = Date.now();
  const t = chicagoToday(nowMs);
  const tomorrow = chicagoMidnight(t.y, t.m0, t.d + 1);
  let from: number;
  let to = tomorrow;
  let key = sp.range ?? "30";
  let label: string;

  if (sp.from && DAY_RE.test(sp.from)) {
    const [fy, fm, fd] = sp.from.split("-").map(Number);
    from = chicagoMidnight(fy, fm - 1, fd);
    if (sp.to && DAY_RE.test(sp.to)) {
      const [ty, tm, td] = sp.to.split("-").map(Number);
      to = chicagoMidnight(ty, tm - 1, td + 1);
    }
    key = "custom";
    if (to <= from) to = from + 86_400_000;
    if (to - from > 400 * 86_400_000) from = to - 400 * 86_400_000;
    label = `${sp.from} to ${dayString(to - 1)}`;
  } else {
    const preset = PRESETS.find((p) => p.key === key) ?? PRESETS[1];
    key = preset.key;
    from = chicagoMidnight(t.y, t.m0, t.d - (preset.days - 1));
    label = `Last ${preset.days} days`;
  }

  const len = to - from;
  return {
    key,
    label,
    from: new Date(from),
    to: new Date(to),
    prevFrom: new Date(from - len),
    prevTo: new Date(from),
    compare: sp.compare === "1",
    fromDay: dayString(from),
    toDay: dayString(to - 1),
  };
}

export function rangeQuery(r: Range, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams();
  if (r.key === "custom") {
    q.set("from", r.fromDay);
    q.set("to", r.toDay);
  } else {
    q.set("range", r.key);
  }
  if (r.compare) q.set("compare", "1");
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return `?${q.toString()}`;
}

/** Ad run state from its schedule, as of now. */
export function runState(status: string, startsAt: string | null, endsAt: string | null): "Running" | "Scheduled" | "Ended" | "Paused" {
  if (status !== "active") return "Paused";
  const now = Date.now();
  if (startsAt && new Date(startsAt).getTime() > now) return "Scheduled";
  if (endsAt && new Date(endsAt).getTime() < now) return "Ended";
  return "Running";
}

export function isPast(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}
