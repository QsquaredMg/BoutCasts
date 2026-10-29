// Offline support for the kiosk iPad. Everything lives in this browser's localStorage, keyed by kiosk link.
// - manifest: the ballot plus salted fingerprints (hash of election|code|name) of students who haven't voted,
//   loaded by a teacher with the PIN. Lets a student check in with no connection.
// - queue: finished ballots waiting to be sent. Each carries a request id so a send can safely repeat.

export type Race = { race_id: string; title: string; options: { id: string; name: string; description: string | null; image_url: string | null; video_url?: string | null; clip_url?: string | null }[] };
export type QueueItem = { requestId: string; code: string; name: string; choices: Record<string, string | null>; castAt: string; problem?: string };
export type Manifest = { electionId: string; ballot: Race[]; hashes: string[]; preparedAt: string; closesAt: string | null };

const key = (token: string, part: string) => `kiosk:${token.slice(0, 16)}:${part}`;

export function load<T>(token: string, part: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key(token, part));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(token: string, part: string, value: unknown): void {
  try {
    localStorage.setItem(key(token, part), JSON.stringify(value));
  } catch {
    /* storage full or blocked: the in-memory copy still works until reload */
  }
}

export function normName(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function fingerprint(electionId: string, code: string, name: string): Promise<string> {
  const data = new TextEncoder().encode(`${electionId}|${code.trim().toUpperCase()}|${normName(name)}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** POST JSON with a timeout. Throws on a network failure or timeout so callers can queue instead. */
export async function post(url: string, body: unknown, ms = 8000): Promise<{ status: number; data: Record<string, unknown> }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, data };
  } finally {
    clearTimeout(t);
  }
}
