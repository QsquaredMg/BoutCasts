import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { isPublicBout, PUBLIC_BOUT_FIELDS } from "@/lib/publicBouts";

const BASE_URL = "https://www.boutcasts.com";

// Rebuild the sitemap at most once an hour.
export const revalidate = 3600;

const STATIC_ROUTES = [
  "",
  "/host",
  "/schools",
  "/discover",
  "/create",
  "/matchups",
  "/explore",
  "/debates",
  "/competitions",
  "/live-vote",
  "/leaderboard",
  "/predictions",
  "/predictions/play",
  "/predictions/leaderboard",
  "/sponsor",
  "/how-it-works",
  "/submit",
  "/search",
  "/login",
  "/signup",
  "/privacy",
  "/terms",
];

type Entry = MetadataRoute.Sitemap[number];

async function dynamicEntries(): Promise<Entry[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const [bouts, categories, showcases, debates] = await Promise.all([
    supabase
      .from("bouts")
      .select(`id, created_at, bracket_key, competitor_a_name, competitor_b_name, ${PUBLIC_BOUT_FIELDS}`)
      .in("status", ["live", "final"])
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("categories").select("id").eq("is_listed", true).limit(200),
    supabase.from("showcases").select("id, created_at").neq("status", "draft").limit(200),
    supabase.from("debate_topics").select("id, created_at").limit(200),
  ]);

  const out: Entry[] = [];
  const brackets = new Set<string>();
  for (const b of (bouts.data ?? []) as Array<Record<string, string | null>>) {
    if (!isPublicBout(b as Parameters<typeof isPublicBout>[0])) continue;
    out.push({ url: `${BASE_URL}/bout/${b.id}`, lastModified: new Date(b.created_at as string), changeFrequency: "hourly", priority: 0.7 });
    if (b.bracket_key) brackets.add(b.bracket_key);
  }
  for (const k of brackets) out.push({ url: `${BASE_URL}/bracket/${encodeURIComponent(k)}`, changeFrequency: "daily", priority: 0.6 });
  for (const c of categories.data ?? []) out.push({ url: `${BASE_URL}/c/${c.id}`, changeFrequency: "daily", priority: 0.6 });
  for (const s of showcases.data ?? []) out.push({ url: `${BASE_URL}/showcase/${s.id}`, lastModified: new Date(s.created_at), changeFrequency: "hourly", priority: 0.7 });
  for (const d of debates.data ?? []) out.push({ url: `${BASE_URL}/debates/${d.id}`, lastModified: new Date(d.created_at), changeFrequency: "daily", priority: 0.6 });
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics: Entry[] = STATIC_ROUTES.map((route) => ({
    url: `${BASE_URL}${route}`,
    changeFrequency: route === "" ? "hourly" : "daily",
    priority: route === "" ? 1 : 0.6,
  }));
  try {
    return statics.concat(await dynamicEntries());
  } catch {
    return statics;
  }
}
