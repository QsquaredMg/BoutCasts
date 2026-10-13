import type { SupabaseClient } from "@supabase/supabase-js";

const norm = (s: string) => ` ${s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim()} `;

export type SchoolTag = { name: string; instagram: string | null; facebook: string | null };

/** Schools in the team directory that are named in this text and have a social account on file. */
export async function findSchoolTags(db: SupabaseClient, text: string): Promise<SchoolTag[]> {
  if (!text.trim()) return [];
  const { data } = await db
    .from("team_directory")
    .select("name, full_name, instagram_handle, facebook_page")
    .eq("hidden", false)
    .or("instagram_handle.not.is.null,facebook_page.not.is.null")
    .limit(500);
  const hay = norm(text);
  const found: SchoolTag[] = [];
  const seen = new Set<string>();
  const teams = (data ?? []).sort((a, b) => (b.full_name?.length ?? 0) - (a.full_name?.length ?? 0));
  for (const t of teams) {
    const names = [t.full_name, t.name].filter((n): n is string => !!n && n.trim().length >= 4);
    if (!names.some((n) => hay.includes(norm(n)))) continue;
    const ig = t.instagram_handle?.trim().replace(/^@/, "") || null;
    const key = ig ?? t.facebook_page ?? t.name;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ name: t.full_name || t.name, instagram: ig, facebook: t.facebook_page?.trim() || null });
    if (found.length >= 3) break;
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
