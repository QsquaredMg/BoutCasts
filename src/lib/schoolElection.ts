import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FREE_ROLE_KEYS, ROLE_KEYS } from "@/lib/electionRoles";

// Server-only helpers for School Election kiosk mode. See docs/sql/kiosk_mode.sql.

// No 0/O, 1/I/L: a teacher reads these out and a student types them.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 6;

export function generateCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

export function generateUniqueCodes(count: number, taken: Set<string>): string[] {
  const out: string[] = [];
  while (out.length < count) {
    const c = generateCode();
    if (taken.has(c)) continue;
    taken.add(c);
    out.push(c);
  }
  return out;
}

export function normName(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

export function newKioskToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(pin, salt, 32);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = scryptSync(pin, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ElectionRow = {
  id: string;
  organizer_id: string;
  title: string;
  school_name: string | null;
  tier: "free" | "small" | "medium" | "large";
  kiosks: number;
  days: number;
  price_cents: number;
  exit_pin_hash: string;
  status: "draft" | "live" | "closed";
  starts_at: string | null;
  closes_at: string | null;
  brand_logo_url: string | null;
  cover_image_url: string | null;
  brand_color: string | null;
  brand_bg_color: string | null;
  brand_bg_image_url: string | null;
  show_tally: boolean;
  open_ended: boolean;
  is_practice: boolean;
  certified_at: string | null;
  certified_by: string | null;
  certified_note: string | null;
  fundraiser_enabled: boolean;
  fundraiser_goal_cents: number | null;
  require_registration: boolean;
  registration_closes_at: string | null;
  campaign_page_enabled: boolean;
  forum_enabled: boolean;
  link_voting: boolean;
};

async function loadElectionAccess(id: string) {
  if (!UUID.test(id)) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: NextResponse.json({ error: "Sign in required" }, { status: 401 }) } as const;
  const admin = createAdminClient();
  const { data: election } = await admin.from("school_elections").select("*").eq("id", id).maybeSingle();
  if (!election) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", auth.user.id).maybeSingle();
  const isAdmin = !!me?.is_admin;
  const isOwner = election.organizer_id === auth.user.id;
  let isMod = false;
  if (!isOwner && !isAdmin) {
    const { data: ok } = await supabase.rpc("school_election_can_moderate", { p_id: id });
    isMod = ok === true;
  }
  return { admin, election: election as ElectionRow, user: auth.user, isAdmin, isOwner, isMod } as const;
}

// Signed-in organizer (or admin) who owns the election, else an error response to return.
// Money and destructive actions use this: a moderator is turned away.
export async function requireElectionOwner(id: string) {
  const r = await loadElectionAccess(id);
  if (r.error) return { error: r.error } as const;
  if (!r.isOwner && !r.isAdmin) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  return { admin: r.admin, election: r.election, user: r.user, isAdmin: r.isAdmin } as const;
}

// Owner, admin or an invited moderator. Day-to-day running of the election.
export async function requireElectionAccess(id: string) {
  const r = await loadElectionAccess(id);
  if (r.error) return { error: r.error } as const;
  if (!r.isOwner && !r.isAdmin && !r.isMod) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  return { admin: r.admin, election: r.election, user: r.user, isAdmin: r.isAdmin, viewerRole: r.isOwner ? ("owner" as const) : r.isAdmin ? ("admin" as const) : ("moderator" as const) } as const;
}

// Whether the election is open for voting right now.
export function isOpen(e: Pick<ElectionRow, "status" | "closes_at">): boolean {
  return e.status === "live" && (e.closes_at == null || new Date(e.closes_at) > new Date());
}

/** Same normal form the database uses for the name check. */
export function voterHash(electionId: string, code: string, name: string): string {
  return createHash("sha256").update(`${electionId}|${code.trim().toUpperCase()}|${normName(name)}`).digest("hex");
}

const STAFF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newStaffCode(): { code: string; hash: string } {
  const bytes = randomBytes(10);
  const code = Array.from(bytes, (b) => STAFF_ALPHABET[b % STAFF_ALPHABET.length]).join("");
  return { code, hash: hashToken(code) };
}

/** Teacher PIN check for a kiosk, with the shared wrong-PIN limit (5 per 10 minutes per kiosk). */
export async function checkKioskPin(token: string, pin: string) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const hash = hashToken(token);
  const { data: kiosk } = await admin.from("election_kiosks").select("id, election_id").eq("token_hash", hash).maybeSingle();
  if (!kiosk) return { ok: false as const, status: 404, error: "kiosk_unknown" };
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await admin.from("election_audit").select("id", { count: "exact", head: true }).eq("kiosk_id", kiosk.id).eq("kind", "bad_pin").gte("created_at", since);
  if ((count ?? 0) >= 5) return { ok: false as const, status: 429, error: "wait" };
  const { data: el } = await admin.from("school_elections").select("exit_pin_hash").eq("id", kiosk.election_id).maybeSingle();
  if (!el || !verifyPin(pin, el.exit_pin_hash)) {
    await admin.from("election_audit").insert({ election_id: kiosk.election_id, kiosk_id: kiosk.id, kind: "bad_pin" });
    return { ok: false as const, status: 401, error: "bad_pin" };
  }
  return { ok: true as const, admin, hash, kioskId: kiosk.id, electionId: kiosk.election_id as string };
}

/** Booth desk access: the organizer's login, or a staff seat code sent in the x-desk-code header. */
export type StaffRole = string;
export const STAFF_ROLES: StaffRole[] = ROLE_KEYS;

/**
 * Organizer login, or a staff code in the x-desk-code header. The organizer always passes. A staff seat passes only if its
 * role is in `allow` (default: the two roles that work the booth desk). Returns who is acting, for the incident log.
 */
export async function requireDeskAccess(req: Request, id: string, allow: StaffRole[] = ["check_in", "judge"]) {
  const code = req.headers.get("x-desk-code");
  if (code && UUID.test(id)) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data } = await admin.from("election_staff").select("id, label, role, option_id").eq("election_id", id).eq("code_hash", hashToken(code.trim().toUpperCase())).is("revoked_at", null).maybeSingle();
    if (!data) return { error: NextResponse.json({ error: "That staff code isn't valid." }, { status: 401 }) } as const;
    const role = data.role as StaffRole;
    if (!allow.includes(role)) return { error: NextResponse.json({ error: "Your seat can't do that." }, { status: 403 }) } as const;
    // Student roles need the organizer's Student Roles plan; the three booth roles are free.
    if (!FREE_ROLE_KEYS.includes(role)) {
      const { data: el } = await admin.from("school_elections").select("organizer_id").eq("id", id).maybeSingle();
      if (!(await schoolRolesActive(admin, el?.organizer_id))) return { error: NextResponse.json({ error: "The Student Roles plan isn't active for this election." }, { status: 402 }) } as const;
    }
    return { admin, role, staffId: data.id as string, label: data.label as string, optionId: (data.option_id as string | null) ?? null } as const;
  }
  const owner = await requireElectionAccess(id);
  if ("error" in owner && owner.error) return { error: owner.error } as const;
  if (!("admin" in owner)) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  return { admin: owner.admin, role: "owner" as const, staffId: null, label: "Organizer", optionId: null as string | null } as const;
}

export type ElectionBrand = {
  title: string;
  school_name: string | null;
  brand_logo_url: string | null;
  cover_image_url: string | null;
  brand_color: string | null;
  brand_bg_color: string | null;
  brand_bg_image_url: string | null;
};

/** The school's look, safe to show anywhere (no PIN, no roster). */
export async function getElectionBrand(id: string): Promise<ElectionBrand | null> {
  if (!UUID.test(id)) return null;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data } = await createAdminClient()
    .from("school_elections")
    .select("title, school_name, brand_logo_url, cover_image_url, brand_color, brand_bg_color, brand_bg_image_url")
    .eq("id", id)
    .maybeSingle();
  return (data as ElectionBrand | null) ?? null;
}

/** Adds `clip_url` (a pasted YouTube/Vimeo/Drive link) to every candidate on a ballot that has one. */
export async function addClipUrls<T extends { options: { id: string; clip_url?: string | null }[] }>(
  admin: { from: (t: string) => any }, // eslint-disable-line @typescript-eslint/no-explicit-any
  ballot: T[] | null | undefined,
): Promise<T[]> {
  const rows = Array.isArray(ballot) ? ballot : [];
  const ids = rows.flatMap((r) => r.options.map((o) => o.id));
  if (ids.length === 0) return rows;
  const { data } = await admin.from("live_vote_options").select("id, source_url").in("id", ids).eq("source_type", "link");
  const byId = new Map<string, string | null>(((data ?? []) as { id: string; source_url: string | null }[]).map((l) => [l.id, l.source_url]));
  for (const r of rows) for (const o of r.options) o.clip_url = byId.get(o.id) ?? null;
  return rows;
}

/** Whether this organizer has the Student Roles plan (see docs/sql/election_roles.sql). */
export async function schoolRolesActive(admin: { rpc: (fn: string, args: Record<string, unknown>) => any }, userId: string | null | undefined): Promise<boolean> { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!userId) return false;
  const { data, error } = await admin.rpc("school_roles_active", { p_user: userId });
  return !error && data === true;
}

/** Who did what: role sign-ins and seat changes. Never stores student names or votes. */
export async function logRoleEvent(
  admin: { from: (t: string) => any }, // eslint-disable-line @typescript-eslint/no-explicit-any
  e: { electionId: string; staffId?: string | null; role?: string | null; action: "seat_created" | "seat_revoked" | "sign_in" | "bad_code"; label?: string | null },
): Promise<void> {
  await admin.from("election_role_events").insert({
    election_id: e.electionId,
    staff_id: e.staffId ?? null,
    role: e.role ?? null,
    action: e.action,
    label: e.label ? e.label.slice(0, 60) : null,
  });
}


const cleanText = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Saves a candidate's slogan, up to three platform points and an optional pasted video link.
 * Used by the organizer's panel and by a candidate or campaign manager editing their own page.
 */
export async function saveCandidateProfile(
  admin: { from: (t: string) => any }, // eslint-disable-line @typescript-eslint/no-explicit-any
  electionId: string,
  optionId: string,
  body: { slogan?: unknown; platform?: unknown; videoLink?: unknown },
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { normalizeVideoLink } = await import("@/lib/clipSource");
  const { data: races } = await admin.from("live_vote_events").select("id").eq("election_id", electionId);
  const { data: option } = await admin.from("live_vote_options").select("id, event_id").eq("id", optionId).maybeSingle();
  if (!option || !((races ?? []) as { id: string }[]).some((r) => r.id === option.event_id)) return { ok: false, status: 404, error: "Unknown candidate" };

  const points = (Array.isArray(body.platform) ? body.platform : []).map((p: unknown) => cleanText(p, 140)).filter(Boolean).slice(0, 3);
  const slogan = cleanText(body.slogan, 100) || null;
  if (typeof body.videoLink === "string") {
    const raw = body.videoLink.trim();
    if (raw) {
      const link = normalizeVideoLink(raw);
      if (!link) return { ok: false, status: 400, error: "We can't play that link. Use a YouTube, Vimeo, TikTok or Instagram video link." };
      const { error: vErr } = await admin.from("live_vote_options").update({ source_type: "link", source_url: link, media_seconds: null }).eq("id", optionId);
      if (vErr) return { ok: false, status: 500, error: "Couldn't save the video." };
    } else {
      await admin.from("live_vote_options").update({ source_type: null, source_url: null, media_seconds: null }).eq("id", optionId).eq("source_type", "link");
    }
  }
  const { error } = await admin.from("election_candidate_profiles").upsert({ option_id: optionId, election_id: electionId, slogan, platform: points, updated_at: new Date().toISOString() }, { onConflict: "option_id" });
  if (error) return { ok: false, status: 500, error: "Couldn't save." };
  return { ok: true };
}
