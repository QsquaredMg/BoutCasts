import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AdminPaidBouts, { type AdminBout } from "@/components/AdminPaidBouts";
import type { PaidBoutStatus } from "@/lib/paidBouts";

export default async function AdminPaidBoutsPage() {
  const supabase = await createClient();
  const { data: bouts } = await supabase
    .from("paid_bouts")
    .select("id, title, status, organizer_id, entry_fee_cents, min_entries, entry_deadline, review_note, profiles!paid_bouts_organizer_id_fkey(username), paid_bout_prizes(amount_cents), paid_bout_entries(status), paid_bout_payouts(id, seq, kind, place, amount_cents, status, method, recipient_id)")
    .order("created_at", { ascending: false });

  const recipientIds = new Set<string>();
  for (const b of bouts ?? []) for (const p of (b.paid_bout_payouts as { recipient_id: string | null }[]) ?? []) if (p.recipient_id) recipientIds.add(p.recipient_id);
  const { data: recips } = recipientIds.size
    ? await supabase.from("profiles").select("id, username").in("id", Array.from(recipientIds))
    : { data: [] as { id: string; username: string }[] };
  const names = new Map((recips ?? []).map((r) => [r.id, r.username]));

  const rows: AdminBout[] = (bouts ?? []).map((b) => {
    const org = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
    const payouts = ((b.paid_bout_payouts as { id: string; seq: number; kind: string; place: number | null; amount_cents: number; status: string; method: string | null; recipient_id: string | null }[]) ?? [])
      .slice()
      .sort((a, c) => a.seq - c.seq)
      .map((p) => ({ id: p.id, seq: p.seq, kind: p.kind, place: p.place, amount_cents: p.amount_cents, status: p.status, method: p.method, recipient: p.recipient_id ? names.get(p.recipient_id) ?? null : null }));
    return {
      id: b.id,
      title: b.title,
      status: b.status as PaidBoutStatus,
      organizer: (org as { username?: string } | null)?.username ?? null,
      entry_fee_cents: b.entry_fee_cents,
      min_entries: b.min_entries,
      entry_deadline: b.entry_deadline,
      review_note: b.review_note,
      prize_total: ((b.paid_bout_prizes as { amount_cents: number }[]) ?? []).reduce((s, p) => s + p.amount_cents, 0),
      paid_entries: ((b.paid_bout_entries as { status: string }[]) ?? []).filter((e) => e.status === "paid").length,
      payouts,
    };
  });

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Paid bouts</h2>
        <Link href="/paid-bouts/new" className="text-sm font-semibold underline">Create one</Link>
      </div>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Review organizer bouts before they open, and send payouts in order: platform fee, prizes, then the organizer.
      </p>
      <AdminPaidBouts bouts={rows} />
    </div>
  );
}
