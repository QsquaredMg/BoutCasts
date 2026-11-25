import type { SupabaseClient } from "@supabase/supabase-js";
import { queueFinishedResults } from "./collect";
import { publishQueuedPost } from "./publishPost";

/** Queues newly finished results and, in "auto" mode, publishes the oldest pending posts. */
export async function runSocial(db: SupabaseClient) {
  const errors: string[] = [];
  const added = await queueFinishedResults(db, errors);
  if (errors.length) console.error("social: queue errors", errors.join(" | "));
  const { data: s } = await db.from("social_settings").select("mode").eq("id", 1).maybeSingle();
  let posted = 0;
  if (s?.mode === "auto") {
    const { data: pending } = await db.from("social_posts").select("id").eq("status", "pending").order("created_at").limit(8);
    for (const p of pending ?? []) if ((await publishQueuedPost(db, p.id)).ok) posted++;
  }
  return { added, posted, errors };
}
