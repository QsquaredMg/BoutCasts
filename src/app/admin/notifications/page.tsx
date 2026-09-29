import { createAdminClient } from "@/lib/supabase/admin";
import AdminPushComposer, { type PushTarget, type BroadcastRow } from "@/components/AdminPushComposer";

// Admin > Notifications: send a push about a popular bout or Live Vote.
// (The admin layout already restricts this page to admins.)
export default async function AdminNotificationsPage() {
  const admin = createAdminClient();

  const [{ data: bouts }, { data: events }, { count: devices }, { data: history }] = await Promise.all([
    admin
      .from("bouts")
      .select("id, title, competitor_a_name, competitor_b_name, status")
      .in("status", ["live", "upcoming"])
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("live_vote_events")
      .select("id, title, status, listed_publicly")
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .limit(100),
    admin.from("push_subscriptions").select("id", { count: "exact", head: true }),
    admin
      .from("push_broadcasts")
      .select("id, title, body, link, devices_targeted, devices_delivered, inbox_recipients, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const boutIds = (bouts ?? []).map((b) => b.id);
  const eventIds = (events ?? []).map((e) => e.id);
  const [{ data: bv }, { data: ev }] = await Promise.all([
    boutIds.length ? admin.from("votes").select("bout_id").in("bout_id", boutIds) : Promise.resolve({ data: [] as { bout_id: string }[] }),
    eventIds.length
      ? admin.from("live_votes").select("event_id").in("event_id", eventIds)
      : Promise.resolve({ data: [] as { event_id: string }[] }),
  ]);
  const boutVotes = new Map<string, number>();
  for (const v of bv ?? []) boutVotes.set(v.bout_id, (boutVotes.get(v.bout_id) ?? 0) + 1);
  const eventVotes = new Map<string, number>();
  for (const v of ev ?? []) eventVotes.set(v.event_id, (eventVotes.get(v.event_id) ?? 0) + 1);

  const targets: PushTarget[] = [
    ...(bouts ?? []).map((b) => ({
      type: "bout" as const,
      id: b.id,
      label: b.title || `${b.competitor_a_name} vs ${b.competitor_b_name}`,
      detail: `${b.competitor_a_name} vs ${b.competitor_b_name}`,
      votes: boutVotes.get(b.id) ?? 0,
      link: `/bout/${b.id}`,
    })),
    ...(events ?? []).map((e) => ({
      type: "live_vote" as const,
      id: e.id,
      label: e.title,
      detail: e.listed_publicly ? "Live Vote · on Explore" : "Live Vote · link only",
      votes: eventVotes.get(e.id) ?? 0,
      link: `/vote/${e.id}`,
    })),
  ].sort((a, b) => b.votes - a.votes);

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Notifications
      </h2>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Send a push notification about a popular bout or Live Vote to everyone who turned notifications on.
        People turn them on from their profile page.
      </p>
      <AdminPushComposer targets={targets} deviceCount={devices ?? 0} history={(history ?? []) as BroadcastRow[]} />
    </div>
  );
}
