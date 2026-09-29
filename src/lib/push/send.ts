import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

// Server-only: send one push message to every device of the given accounts.
// Silently does nothing if push isn't configured. Removes dead devices.
export async function sendPushToUsers(
  admin: SupabaseClient,
  userIds: string[],
  message: { title: string; body: string; url: string; tag?: string }
): Promise<number> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const ids = userIds.filter(Boolean);
  if (!publicKey || !privateKey || ids.length === 0) return 0;
  webpush.setVapidDetails("mailto:support@boutcasts.com", publicKey, privateKey);

  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", ids);
  const payload = JSON.stringify(message);
  const dead: string[] = [];
  let delivered = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 60 * 60 * 12,
          urgency: "high",
        });
        delivered++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id);
      }
    })
  );
  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
  return delivered;
}
