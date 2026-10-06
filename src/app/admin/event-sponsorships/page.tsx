import { createClient } from "@/lib/supabase/server";
import AdminEventSponsorships, { type SponsorshipRow } from "@/components/AdminEventSponsorships";

export default async function AdminEventSponsorshipsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_sponsorships")
    .select("id, company_name, gross_cents, platform_fee_cents, organizer_share_cents, status, organizer_payout_status, payout_method, live_vote_events(title, status, organizer_id)")
    .order("created_at", { ascending: false });
  const ev = (r: { live_vote_events: unknown }) => (Array.isArray(r.live_vote_events) ? r.live_vote_events[0] : r.live_vote_events) as { title: string; status: string; organizer_id: string } | null;
  const ids = Array.from(new Set((data ?? []).map((r) => ev(r)?.organizer_id).filter(Boolean))) as string[];
  const { data: profs } = ids.length ? await supabase.from("profiles").select("id, username").in("id", ids) : { data: [] as { id: string; username: string }[] };
  const names = new Map((profs ?? []).map((p) => [p.id, p.username]));
  const rows: SponsorshipRow[] = (data ?? []).map((r) => {
    const e = ev(r);
    return {
      id: r.id, event_title: e?.title ?? "Event", event_closed: e?.status === "closed", organizer: e ? names.get(e.organizer_id) ?? null : null,
      company_name: r.company_name, gross_cents: r.gross_cents, platform_fee_cents: r.platform_fee_cents, organizer_share_cents: r.organizer_share_cents,
      status: r.status, organizer_payout_status: r.organizer_payout_status, payout_method: r.payout_method,
    };
  });
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-4 text-2xl font-bold">Event sponsorships</h1>
      <AdminEventSponsorships rows={rows} />
    </div>
  );
}
