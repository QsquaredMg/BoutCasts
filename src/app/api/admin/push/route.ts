import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeNext } from "@/lib/safeNext";

// Admin-only: send a push notification about a bout, a Live Vote, or any
// page on the site to every device that turned notifications on, and
// (optionally) drop the same message in every account's in-app bell.

export const maxDuration = 60;

type Body = {
  title?: string;
  message?: string;
  link?: string;
  targetType?: "bout" | "live_vote" | "custom";
  targetId?: string | null;
  inbox?: boolean;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!me?.is_admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: "Push keys aren't set up on the server yet (VAPID keys)." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const title = (body.title ?? "").trim().slice(0, 80);
  const message = (body.message ?? "").trim().slice(0, 200);
  const link = safeNext(body.link ?? "/");
  const targetType = body.targetType ?? "custom";
  if (!title || !message) return NextResponse.json({ error: "Add a title and a message." }, { status: 400 });
  if (!["bout", "live_vote", "custom"].includes(targetType)) {
    return NextResponse.json({ error: "Unknown target." }, { status: 400 });
  }

  webpush.setVapidDetails("mailto:support@boutcasts.com", publicKey, privateKey);
  const admin = createAdminClient();

  const { data: subs, error: subsErr } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  if (subsErr) return NextResponse.json({ error: subsErr.message }, { status: 500 });

  const payload = JSON.stringify({ title, body: message, url: link, tag: `bc-${targetType}-${body.targetId ?? "x"}` });
  let delivered = 0;
  const dead: string[] = [];
  const okIds: string[] = [];

  // Send in small batches so a big list doesn't overwhelm the function.
  const list = subs ?? [];
  for (let i = 0; i < list.length; i += 50) {
    await Promise.all(
      list.slice(i, i + 50).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
            TTL: 60 * 60 * 6,
            urgency: "high",
          });
          delivered++;
          okIds.push(s.id);
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) dead.push(s.id); // device unsubscribed or app removed
        }
      })
    );
  }
  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
  if (okIds.length) await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).in("id", okIds);

  let inboxRecipients = 0;
  if (body.inbox) {
    const { data: n, error: inboxErr } = await supabase.rpc("admin_broadcast_inbox", {
      p_body: `${title} — ${message}`.slice(0, 280),
      p_link: link,
    });
    if (!inboxErr) inboxRecipients = (n as number) ?? 0;
  }

  await admin.from("push_broadcasts").insert({
    sent_by: user.id,
    title,
    body: message,
    link,
    target_type: targetType,
    target_id: targetType === "custom" ? null : body.targetId ?? null,
    devices_targeted: list.length,
    devices_delivered: delivered,
    inbox_recipients: inboxRecipients,
  });

  return NextResponse.json({ devices: list.length, delivered, removed: dead.length, inboxRecipients });
}
