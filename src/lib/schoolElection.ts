import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  tier: "small" | "medium" | "large";
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
};

// Signed-in organizer (or admin) who owns the election, else an error response to return.
export async function requireElectionOwner(id: string) {
  if (!UUID.test(id)) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: NextResponse.json({ error: "Sign in required" }, { status: 401 }) } as const;
  const admin = createAdminClient();
  const { data: election } = await admin.from("school_elections").select("*").eq("id", id).maybeSingle();
  if (!election) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  if (election.organizer_id !== auth.user.id) {
    const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", auth.user.id).maybeSingle();
    if (!me?.is_admin) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  }
  return { admin, election: election as ElectionRow, user: auth.user } as const;
}

// Whether the election is open for voting right now.
export function isOpen(e: Pick<ElectionRow, "status" | "closes_at">): boolean {
  return e.status === "live" && !!e.closes_at && new Date(e.closes_at) > new Date();
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
