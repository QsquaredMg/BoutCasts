import type { SupabaseClient } from "@supabase/supabase-js";
import { postToFacebook, postToInstagram, socialConfigured, type PlatformResult } from "./publish";

/** Publishes one queued post to every configured platform and records the outcome. */
export async function publishQueuedPost(db: SupabaseClient, id: string) {
  const { data: p } = await db.from("social_posts").select("*").eq("id", id).maybeSingle();
  if (!p) return { ok: false, error: "Not found" };
  if (p.status === "posted") return { ok: true, error: null };
  const cfg = socialConfigured();
  if (!cfg.facebook && !cfg.instagram) return { ok: false, error: "No social accounts are connected yet (see META_* settings)." };

  const results: Record<string, PlatformResult> = { ...(p.results ?? {}) };
  if (cfg.facebook && !results.facebook?.ok) results.facebook = await postToFacebook(id, p.caption_facebook);
  if (cfg.instagram && !results.instagram?.ok) results.instagram = await postToInstagram(id, p.caption_instagram);

  const attempted = Object.values(results);
  const good = attempted.filter((r) => r.ok).length;
  const status = good === 0 ? "failed" : good === attempted.length ? "posted" : "partial";
  const error = attempted.filter((r) => !r.ok).map((r) => r.error).join(" | ") || null;
  await db.from("social_posts").update({ status, results, error, posted_at: good ? new Date().toISOString() : null }).eq("id", id);
  return { ok: good > 0, error };
}
