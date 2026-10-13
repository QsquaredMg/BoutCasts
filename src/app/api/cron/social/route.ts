import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueFinishedResults } from "@/lib/social/collect";
import { publishQueuedPost } from "@/lib/social/publishPost";

// Runs every 15 minutes (vercel.json). Queues newly finished results; in "auto" mode
// it also publishes them. Vercel sends CRON_SECRET as a bearer token.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = createAdminClient();
  const added = await queueFinishedResults(db);
  const { data: s } = await db.from("social_settings").select("mode").eq("id", 1).maybeSingle();
  let posted = 0;
  if (s?.mode === "auto") {
    const { data: pending } = await db.from("social_posts").select("id").eq("status", "pending").order("created_at").limit(5);
    for (const p of pending ?? []) if ((await publishQueuedPost(db, p.id)).ok) posted++;
  }
  return NextResponse.json({ added, posted });
}
