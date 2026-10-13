import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PAID_BOUTS_ENABLED } from "@/lib/features";
import { money } from "@/lib/paidBouts";

export const metadata: Metadata = {
  title: "Paid Bouts",
  description: "Competitions with an entry fee, published rules and guaranteed prizes.",
};

export default async function PaidBoutsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = userData.user
    ? await supabase.from("profiles").select("is_admin").eq("id", userData.user.id).maybeSingle()
    : { data: null };
  const canCreate = PAID_BOUTS_ENABLED || profile?.is_admin === true;

  const { data: bouts } = await supabase
    .from("paid_bouts")
    .select("id, title, entry_fee_cents, entry_deadline, min_entries, paid_bout_prizes(amount_cents)")
    .eq("status", "open")
    .eq("invite_only", false)
    .gt("entry_deadline", new Date().toISOString())
    .order("entry_deadline");

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Paid Bouts</h1>
        {canCreate && (
          <Link href="/paid-bouts/new" className="rounded px-4 py-2 text-sm font-semibold text-white" style={{ background: "var(--red)" }}>
            Create a paid bout
          </Link>
        )}
      </div>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Competitions with an entry fee. Every bout publishes its rules, how winners are chosen and exactly how the money is paid out.
        If a bout doesn&apos;t reach its minimum entries, everyone is refunded.{" "}
        <Link href="/paid-bouts/play" className="font-semibold underline">
          See how it works
        </Link>
      </p>
      {!canCreate && (
        <p className="mb-6 rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
          Want to run a paid bout? <Link href="/host" className="font-semibold underline">Talk to us about hosting.</Link>
        </p>
      )}
      {!bouts || bouts.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>No paid bouts are open right now.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {bouts.map((b) => {
            const prizeTotal = ((b.paid_bout_prizes as { amount_cents: number }[]) ?? []).reduce((s, p) => s + p.amount_cents, 0);
            return (
              <li key={b.id}>
                <Link href={`/paid-bouts/${b.id}`} className="block rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <div className="font-bold">{b.title}</div>
                  <div className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
                    {money(prizeTotal)} in prizes · {money(b.entry_fee_cents)} to enter · closes{" "}
                    {new Date(b.entry_deadline).toLocaleDateString("en-US", { dateStyle: "medium" })}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
