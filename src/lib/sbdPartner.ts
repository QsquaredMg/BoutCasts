import { createHmac, timingSafeEqual } from "crypto";

// School-B-Doo link. Both sides share SBD_SHARED_SECRET. Nothing here trusts a caller without a valid signature.
//   SBD_SHARED_SECRET  long random string, identical in School-B-Doo's BOUTCASTS_SECRET
//   SBD_BASE_URL       School-B-Doo's address, e.g. https://www.schoolbdoo.com (the only place we send requests to)

const secret = () => process.env.SBD_SHARED_SECRET || "";
export const sbdBase = () => (process.env.SBD_BASE_URL || "").replace(/\/+$/, "");
export const sbdConfigured = () => secret().length >= 24 && /^https:\/\//.test(sbdBase());

const hmac = (msg: string) => createHmac("sha256", secret()).update(msg).digest("hex");
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export type Handoff = { sid: string; sname: string; logo: string | null; color: string | null; uid: string; exp: number };

// A staff member in School-B-Doo taps "Run a school election". The token carries the school's name and look. It lasts 30 minutes.
export function verifyHandoff(token: string): Handoff | null {
  if (!sbdConfigured() || typeof token !== "string" || token.length > 4000) return null;
  const [p, sig] = token.split(".");
  if (!p || !sig || !same(hmac("handoff." + p), sig)) return null;
  try {
    const j = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    if (typeof j.sid !== "string" || typeof j.sname !== "string" || typeof j.exp !== "number" || j.exp < Date.now() / 1000) return null;
    return { sid: j.sid.slice(0, 40), sname: j.sname.slice(0, 120), logo: typeof j.logo === "string" && /^https:\/\//.test(j.logo) ? j.logo.slice(0, 600) : null, color: typeof j.color === "string" && /^#[0-9a-f]{6}$/i.test(j.color) ? j.color : null, uid: String(j.uid ?? "").slice(0, 40), exp: j.exp };
  } catch {
    return null;
  }
}

// Header: "t=<unix>,v1=<hmac of t.METHOD.path.body>". Used in both directions.
export function signRequest(method: string, pathAndQuery: string, body: string): string {
  const t = Math.floor(Date.now() / 1000);
  return `t=${t},v1=${hmac(`${t}.${method}.${pathAndQuery}.${body}`)}`;
}

export function verifyRequest(header: string | null, method: string, pathAndQuery: string, body: string): boolean {
  if (!sbdConfigured() || !header) return false;
  const m = /^t=(\d+),v1=([a-f0-9]{64})$/.exec(header);
  if (!m || Math.abs(Date.now() / 1000 - Number(m[1])) > 300) return false;
  return same(hmac(`${m[1]}.${method}.${pathAndQuery}.${body}`), m[2]);
}

// Call a School-B-Doo method (form-encoded, signed). Returns the parsed JSON or null.
export async function sbdCall(method: string, fields: Record<string, string>): Promise<Record<string, unknown> | null> {
  if (!sbdConfigured()) return null;
  const path = `/api/v2/method/${method}`;
  const body = new URLSearchParams(fields).toString();
  const res = await fetch(sbdBase() + path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "X-SBD-Signature": signRequest("POST", path, body) },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return (await res.json().catch(() => null)) as Record<string, unknown> | null;
}
