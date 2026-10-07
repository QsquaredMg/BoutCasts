// Parsing helpers for the admin "Add many games" tool. Pure functions: they turn pasted
// lines or a CSV into rows the admin can review before anything is created.

export const BULK_MAX = 50;

export type BulkRow = {
  key: string;
  home: string;
  away: string;
  /** datetime-local value (YYYY-MM-DDTHH:mm) in the admin's local time, or "" if unknown */
  when: string;
  tie: boolean;
  /** problem found while parsing (shown on the row) */
  problem?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function localValue(y: number, mo: number, d: number, h: number, mi: number): string | null {
  const dt = new Date(y, mo - 1, d, h, mi);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d || h > 23 || mi > 59) return null;
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}`;
}

function clock(h: string, m: string | undefined, ap: string | undefined): [number, number] | null {
  let hh = Number(h);
  const mm = m ? Number(m) : 0;
  if (ap) {
    if (hh < 1 || hh > 12) return null;
    hh = hh % 12 + (ap.toLowerCase() === "pm" ? 12 : 0);
  }
  return hh > 23 || mm > 59 ? null : [hh, mm];
}

const TIME = String.raw`(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?`;
const norm = (ap?: string) => (ap ? ap.replace(/\./g, "") : undefined);

/** Understands "2026-10-10 19:00", "10/10 7:00 PM", "10/10/2026 7pm", "Sat 7pm", and "7:00 PM" (uses defaultDate). */
export function parseWhen(input: string, defaultDate: string, nowMs: number): string | null {
  const t = input.trim().replace(/\s+/g, " ");
  if (!t) return null;
  const today = new Date(nowMs);
  let m: RegExpMatchArray | null;

  if ((m = t.match(new RegExp(String.raw`^(\d{4})-(\d{1,2})-(\d{1,2})[ T]${TIME}$`, "i")))) {
    const c = clock(m[4], m[5], norm(m[6]));
    return c ? localValue(+m[1], +m[2], +m[3], c[0], c[1]) : null;
  }
  if ((m = t.match(new RegExp(String.raw`^(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?,?\s+${TIME}$`, "i")))) {
    const c = clock(m[4], m[5], norm(m[6]));
    if (!c) return null;
    let y = m[3] ? +m[3] : today.getFullYear();
    if (y < 100) y += 2000;
    let v = localValue(y, +m[1], +m[2], c[0], c[1]);
    if (v && !m[3] && new Date(v).getTime() < nowMs - 86_400_000) v = localValue(y + 1, +m[1], +m[2], c[0], c[1]);
    return v;
  }
  if ((m = t.match(new RegExp(String.raw`^(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?,?\s+${TIME}$`, "i")))) {
    const c = clock(m[2], m[3], norm(m[4]));
    if (!c) return null;
    const want = DAYS.indexOf(m[1].toLowerCase());
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate(), c[0], c[1]);
    let add = (want - base.getDay() + 7) % 7;
    if (add === 0 && base.getTime() <= nowMs) add = 7;
    base.setDate(base.getDate() + add);
    return localValue(base.getFullYear(), base.getMonth() + 1, base.getDate(), c[0], c[1]);
  }
  if ((m = t.match(new RegExp(`^${TIME}$`, "i"))) && (m[2] || m[3])) {
    const c = clock(m[1], m[2], norm(m[3]));
    const d = defaultDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return c && d ? localValue(+d[1], +d[2], +d[3], c[0], c[1]) : null;
  }
  return null;
}

/** "Alabama vs Auburn" (first is home), "Auburn at Alabama" / "Auburn @ Alabama" (second is home). */
export function parseMatchup(s: string): { home: string; away: string } | null {
  const t = s.trim();
  let m = t.match(/^(.+?)\s+(?:vs\.?|v\.?|versus)\s+(.+)$/i);
  if (m) return { home: m[1].trim(), away: m[2].trim() };
  m = t.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  if (m) return { home: m[2].trim(), away: m[1].trim() };
  return null;
}

const TIE_RE = /^(tie|ties|draw|yes|true|y|1)$/i;
let seq = 0;
const nextKey = () => `r${++seq}`;

function build(matchup: string, whenText: string, tieText: string, defaultDate: string, nowMs: number, srcHome?: string, srcAway?: string): BulkRow {
  let home = srcHome?.trim() ?? "", away = srcAway?.trim() ?? "";
  let problem: string | undefined;
  if (!home || !away) {
    const mt = parseMatchup(matchup);
    if (mt) ({ home, away } = mt);
    else problem = "Couldn't find two teams. Write it like Alabama vs Auburn.";
  }
  const when = parseWhen(whenText, defaultDate, nowMs) ?? "";
  if (!when && !problem) problem = whenText.trim() ? `Couldn't read the time "${whenText.trim()}".` : "Add a start time.";
  return { key: nextKey(), home, away, when, tie: TIE_RE.test(tieText.trim()), problem };
}

/** One game per line: "Home vs Away, when[, tie]". Fields split on comma, tab or |. */
export function parsePaste(text: string, defaultDate: string, nowMs: number): BulkRow[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((line) => {
      const parts = line.split(/\t|\||,(?=\s*(?:\d|sun|mon|tue|wed|thu|fri|sat))/i).map((p) => p.trim());
      const [matchup = "", whenText = "", tieText = ""] = parts.length >= 2 ? parts : [line, "", ""];
      // Allow "...,7pm, tie" where the tie flag lands after a comma that wasn't split above.
      const tail = whenText.split(/\s*,\s*/);
      return build(matchup, tail[0] ?? "", tieText || tail[1] || "", defaultDate, nowMs);
    });
}

/** Minimal CSV reader: quotes, commas, newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

/** Columns (any order, case-insensitive): home, away, start | date + time, tie. */
export function rowsFromCsv(text: string, defaultDate: string, nowMs: number): BulkRow[] {
  const table = parseCsv(text);
  if (table.length < 2) return [];
  const head = table[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const iHome = col("home", "home team", "home_name"), iAway = col("away", "away team", "away_name");
  const iStart = col("start", "starts", "start time", "start_time", "when", "datetime", "date time");
  const iDate = col("date"), iTime = col("time"), iTie = col("tie", "tie allowed", "allow tie", "draw");
  return table.slice(1).map((r) => {
    const get = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
    const whenText = iStart >= 0 ? get(iStart) : `${get(iDate)} ${get(iTime)}`.trim();
    return build("", whenText, get(iTie), defaultDate, nowMs, get(iHome), get(iAway));
  });
}

export const CSV_TEMPLATE =
  "home,away,start,tie\nAlabama,Auburn,2026-11-28 19:00,\nChiefs,Bills,11/30/2026 7:20 PM,\nArsenal,Chelsea,12/06/2026 11:30 AM,tie\n";
