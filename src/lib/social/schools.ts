import type { SupabaseClient } from "@supabase/supabase-js";

const norm = (s: string) => ` ${s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim()} `;

export type SchoolTag = { name: string; instagram: string | null; facebook: string | null };

type Row = { name: string | null; full_name: string | null; short_name: string | null; instagram_handle: string | null; facebook_page: string | null };

async function loadTaggable(db: SupabaseClient): Promise<Row[]> {
  const { data } = await db
    .from("team_directory")
    .select("name, full_name, short_name, instagram_handle, facebook_page")
    .eq("hidden", false)
    .or("instagram_handle.not.is.null,facebook_page.not.is.null")
    .limit(500);
  return (data ?? []) as Row[];
}

const toTag = (t: Row): SchoolTag => ({
  name: (t.full_name || t.name) as string,
  instagram: t.instagram_handle?.trim().replace(/^@/, "") || null,
  facebook: t.facebook_page?.trim() || null,
});
const keyOf = (t: SchoolTag) => t.instagram ?? t.facebook ?? t.name;

/**
 * Schools in the team directory that are named in this free text and have a social account on file.
 * Longest names match first and each match is removed from the text, so "Texas A&M" never also tags "Texas".
 */
export async function findSchoolTags(db: SupabaseClient, text: string, limit = 3): Promise<SchoolTag[]> {
  if (!text.trim()) return [];
  const rows = (await loadTaggable(db)).sort((a, b) => (b.full_name?.length ?? 0) - (a.full_name?.length ?? 0));
  let hay = norm(text);
  const found: SchoolTag[] = [];
  const seen = new Set<string>();
  for (const t of rows) {
    const names = [t.full_name, t.name].filter((n): n is string => !!n && n.trim().length >= 4);
    const hit = names.map(norm).find((n) => hay.includes(n));
    if (!hit) continue;
    hay = hay.split(hit).join(" ");
    const tag = toTag(t);
    if (seen.has(keyOf(tag))) continue;
    seen.add(keyOf(tag));
    found.push(tag);
    if (found.length >= limit) break;
  }
  return found;
}

/**
 * Tags for an exact list of team names (every team in a prediction game or bracket).
 * A name must equal a directory name, full name or short name, so look-alikes are never tagged by accident.
 * Results keep the order the names were given in.
 */
export async function findSchoolTagsByNames(db: SupabaseClient, names: string[], limit = 8): Promise<SchoolTag[]> {
  const wanted = [...new Set(names.map((n) => norm(n)).filter((n) => n.trim().length >= 3))];
  if (!wanted.length) return [];
  const rows = await loadTaggable(db);
  const index = new Map<string, Row>();
  for (const t of rows) for (const n of [t.name, t.full_name, t.short_name]) if (n && !index.has(norm(n))) index.set(norm(n), t);
  const found: SchoolTag[] = [];
  const seen = new Set<string>();
  for (const w of wanted) {
    const t = index.get(w);
    if (!t) continue;
    const tag = toTag(t);
    if (seen.has(keyOf(tag))) continue;
    seen.add(keyOf(tag));
    found.push(tag);
    if (found.length >= limit) break;
  }
  return found;
}

/** The "rally your school" line. Instagram gets real @mentions; Facebook can't tag Pages through the API, so it names them. */
export function schoolLines(tags: SchoolTag[]) {
  if (!tags.length) return { facebook: "", instagram: "" };
  const fb = tags.map((t) => t.facebook ?? t.name).join(" & ");
  const ig = tags.map((t) => (t.instagram ? `@${t.instagram}` : t.name)).join(" ");
  return {
    facebook: `📣 Calling ${fb}! Rally your fans and share this to show your team some support.`,
    instagram: `📣 ${ig} — rally your fans and share this to show your team some support! 💪`,
  };
}
