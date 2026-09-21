import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ModerationQueue from "@/components/ModerationQueue";
import PrizePoolManager from "@/components/PrizePoolManager";

export default async function ModerationPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-8">
        <p style={{ color: "var(--text-faint)" }}>You don&apos;t have access to this page.</p>
        <Link href="/" className="text-sm font-semibold underline" style={{ color: "var(--red)" }}>
          Back to matchups
        </Link>
      </div>
    );
  }

  const { data: pending } = await supabase
    .from("submissions")
    .select("*, categories(name)")
    .in("status", ["pending", "appealed"])
    .order("created_at", { ascending: true });

  const { data: openReports } = await supabase
    .from("reports")
    .select("*, profiles(username)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const [{ data: allBouts }, { data: pools }, { data: contributions }] = await Promise.all([
    supabase.from("bouts").select("id, title").order("created_at", { ascending: false }),
    supabase.from("prize_pools").select("id, bout_id, goal_amount"),
    supabase.from("pool_contributions").select("pool_id, amount"),
  ]);

  const boutTitleById = new Map((allBouts ?? []).map((b) => [b.id, b.title]));
  const raisedByPool = new Map<string, number>();
  for (const c of contributions ?? []) {
    raisedByPool.set(c.pool_id, (raisedByPool.get(c.pool_id) ?? 0) + c.amount);
  }
  const poolBoutIds = new Set((pools ?? []).map((p) => p.bout_id));
  const boutsWithoutPool = (allBouts ?? []).filter((b) => !poolBoutIds.has(b.id));
  const poolRows = (pools ?? []).map((p) => ({
    id: p.id,
    bout_id: p.bout_id,
    goal_amount: p.goal_amount,
    raised: raisedByPool.get(p.id) ?? 0,
    boutTitle: boutTitleById.get(p.bout_id) ?? "Unknown bout",
  }));

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/" className="mb-4 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>
        &larr; Back to matchups
      </Link>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Moderation queue</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Review submissions before they go live.
      </p>
      <ModerationQueue submissions={pending ?? []} />

      <h2 className="mb-3 mt-10 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Prize pools
      </h2>
      <PrizePoolManager boutsWithoutPool={boutsWithoutPool} initialPools={poolRows} />

      <h2 className="mb-3 mt-10 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Open reports
      </h2>
      {(openReports ?? []).length === 0 ? (
        <p style={{ color: "var(--text-faint)" }}>No open reports.</p>
      ) : (
        <div className="bc-card overflow-hidden">
          {(openReports ?? []).map((r, i) => (
            <div key={r.id} className="px-4 py-3" style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">
                  {r.reason} &middot; <span style={{ color: "var(--text-faint)" }}>{r.target_type}</span>
                </span>
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                  reported by {r.profiles?.username ?? "unknown"}
                </span>
              </div>
              {r.details && (
                <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>{r.details}</p>
              )}
              <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
                Target ID: {r.target_id}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
