import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PushOptIn from "@/components/PushOptIn";
import MarkNotificationsRead from "@/components/MarkNotificationsRead";
import type { Notification } from "@/lib/types";

export const metadata: Metadata = { title: "Activity", robots: { index: false } };

function ago(iso: string, now: number) {
  const s = Math.max(1, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function ActivityPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) redirect("/login?next=%2Factivity");

  const [{ data: rows }, { count: pending }] = await Promise.all([
    supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("challenges").select("id", { count: "exact", head: true }).eq("opponent_id", user.id).eq("status", "pending"),
  ]);
  const items = (rows ?? []) as Notification[];
  const unreadIds = items.filter((n) => !n.is_read).map((n) => n.id);
  // Server component: rendered per request, so "now" is stable for this render.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <div className="mx-auto max-w-[720px] px-5 py-8">
      <h1 className="mb-4 text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Activity
      </h1>

      <div className="mb-5">
        <PushOptIn compact />
      </div>

      {(pending ?? 0) > 0 && (
        <Link
          href="/challenges"
          className="bc-card mb-4 flex items-center justify-between gap-3 p-4 transition-colors hover:bg-[var(--surface-2)]"
        >
          <span className="font-bold">🥊 {pending} challenge{pending === 1 ? "" : "s"} waiting for you</span>
          <span className="text-sm font-bold" style={{ color: "var(--red)" }}>
            Respond →
          </span>
        </Link>
      )}

      {items.length === 0 ? (
        <div className="bc-card p-6 text-center text-sm" style={{ color: "var(--text-dim)" }}>
          Nothing yet. Vote on a matchup or follow people, and updates will show up here.
          <div className="mt-3">
            <Link href="/discover" className="font-bold" style={{ color: "var(--red)" }}>
              Find something to vote on →
            </Link>
          </div>
        </div>
      ) : (
        <div className="bc-card flex flex-col overflow-hidden">
          {items.map((n, i) => {
            const body = (
              <div className="flex items-start gap-3 px-4 py-3.5">
                <span
                  className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ background: n.is_read ? "transparent" : "var(--red)" }}
                  aria-label={n.is_read ? undefined : "Unread"}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm" style={{ fontWeight: n.is_read ? 500 : 700 }}>
                    {n.body}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                    {ago(n.created_at, now)}
                  </span>
                </span>
              </div>
            );
            const border = i > 0 ? { borderTop: "1px solid var(--border)" } : undefined;
            return n.link ? (
              <Link key={n.id} href={n.link} className="transition-colors hover:bg-[var(--surface-2)]" style={border}>
                {body}
              </Link>
            ) : (
              <div key={n.id} style={border}>
                {body}
              </div>
            );
          })}
        </div>
      )}
      <MarkNotificationsRead ids={unreadIds} />
    </div>
  );
}
