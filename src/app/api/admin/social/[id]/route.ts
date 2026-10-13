import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishQueuedPost } from "@/lib/social/publishPost";

// Admin actions on one queued post: publish (also retries), skip, or save edited captions.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { data: prof } = await supabase.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle();
  if (!prof?.is_admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { action?: string; caption_facebook?: string; caption_instagram?: string } | null;
  const db = createAdminClient();

  if (body?.action === "skip") {
    await db.from("social_posts").update({ status: "skipped" }).eq("id", id).neq("status", "posted");
    return NextResponse.json({ ok: true });
  }
  if (body?.action === "save") {
    const patch: Record<string, string> = {};
    if (typeof body.caption_facebook === "string") patch.caption_facebook = body.caption_facebook.slice(0, 8000);
    if (typeof body.caption_instagram === "string") patch.caption_instagram = body.caption_instagram.slice(0, 2200);
    await db.from("social_posts").update(patch).eq("id", id).neq("status", "posted");
    return NextResponse.json({ ok: true });
  }
  if (body?.action === "publish") {
    const r = await publishQueuedPost(db, id);
    return NextResponse.json(r, { status: r.ok ? 200 : 502 });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
