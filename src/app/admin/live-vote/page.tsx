import { createClient } from "@/lib/supabase/server";
import AdminLiveVoteManager from "@/components/AdminLiveVoteManager";

export default async function AdminLiveVotePage() {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("live_vote_events")
    .select("id, title, status, tier, price_cents, ads_enabled, created_at, organizer_id")
    .order("created_at", { ascending: false });

  const organizerIds = Array.from(new Set((events ?? []).map((e) => e.organizer_id).filter(Boolean)));
  const { data: organizers } =
    organizerIds.length > 0
      ? await supabase.from("profiles").select("id, username").in("id", organizerIds)
      : { data: [] as { id: string; username: string }[] };

  const usernameById = new Map((organizers ?? []).map((o) => [o.id, o.username]));
  const initialEvents = (events ?? []).map((e) => ({
    ...e,
    organizer_username: usernameById.get(e.organizer_id) ?? null,
  }));

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Live Vote
      </h2>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        See every Live Vote event and control whether a sponsored ad shows on its public ballot page.
        This is admin-only — organizers can&apos;t turn ads on or off for their own event.
      </p>
      <AdminLiveVoteManager initialEvents={initialEvents} />
    </div>
  );
}
