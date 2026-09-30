import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUsers } from "@/lib/push/send";

// Server-only. Records an error in app_errors and pings admins' phones —
// at most one alert every 15 minutes so a bad deploy can't flood them.
const ALERT_COOLDOWN_MS = 15 * 60 * 1000;
const MAX_ROWS_PER_HOUR = 300;

export async function reportAppError(e: {
  source: "client" | "server";
  message: string;
  digest?: string | null;
  path?: string | null;
  userAgent?: string | null;
}) {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return; // not configured (e.g. local dev without the service key)
  }
  const message = (e.message || "Unknown error").slice(0, 500);
  const path = e.path ? e.path.slice(0, 300) : null;

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin.from("app_errors").select("id", { count: "exact", head: true }).gte("created_at", hourAgo);
  if ((count ?? 0) >= MAX_ROWS_PER_HOUR) return;

  const since = new Date(Date.now() - ALERT_COOLDOWN_MS).toISOString();
  const { count: recent } = await admin.from("app_errors").select("id", { count: "exact", head: true }).gte("created_at", since);

  await admin.from("app_errors").insert({
    source: e.source,
    message,
    digest: e.digest?.slice(0, 100) ?? null,
    path,
    user_agent: e.userAgent?.slice(0, 300) ?? null,
  });

  if ((recent ?? 0) > 0) return; // an alert already went out recently
  const { data: admins } = await admin.from("profiles").select("id").eq("is_admin", true);
  await sendPushToUsers(
    admin,
    (admins ?? []).map((a) => a.id),
    {
      title: "⚠️ BoutCasts error",
      body: `${path ?? "Unknown page"}: ${message}`.slice(0, 180),
      url: "/admin/errors",
      tag: "app-error",
    }
  );
}
