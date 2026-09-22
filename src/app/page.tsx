import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Bout } from "@/lib/types";
import { getCategoryIcon } from "@/lib/categoryIcon";
import ContributeButton from "@/components/ContributeButton";
import StopPropagation from "@/components/StopPropagation";

const STATUS_LABEL: Record<Bout["status"], string> = {
  live: "LIVE",
  upcoming: "UPCOMING",
  final: "FINAL",
};

export default async function Home() {
  const supabase = await createClient();

  const { data: bouts, error } = await supabase
    .from("bouts")
    .select("*, categories(name, sponsor_id, sponsors(name)), sponsors(name)")
    .order("created_at", { ascending: false });

  const boutIds = (bouts ?? []).map((b) => b.id);
  const tallies: Record<string, { a: number; b: number }> = {};
  const poolByBout = new Map<string, { id: string; goal_amount: number; raised: number }>();

  if (boutIds.length > 0) {
    const [{ data: votes }, { data: pools }] = await Promise.all([
      supabase.from("votes").select("bout_id, side").in("bout_id", boutIds),
      supabase.from("prize_pools").select("id, bout_id, goal_amount").in("bout_id", boutIds),
    ]);

    for (const v of votes ?? []) {
      if (!tallies[v.bout_id]) tallies[v.bout_id] = { a: 0, b: 0 };
      tallies[v.bout_id][v.side as "a" | "b"]++;
    }

    if (pools && pools.length > 0) {
      const { data: contributions } = await supabase
        .from("pool_contributions")
        .select("pool_id, amount")
        .in("pool_id", pools.map((p) => p.id));
      const raisedByPool = new Map<string, number>();
      for (const c of contributions ?? []) {
        raisedByPool.set(c.pool_id, (raisedByPool.get(c.pool_id) ?? 0) + c.amount);
      }
      for (const p of pools) {
        poolByBout.set(p.bout_id, { id: p.id, goal_amount: p.goal_amount, raised: raisedByPool.get(p.id) ?? 0 });
      }
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <h1
        className="mb-1 text-2xl font-bold"
        style={{ fontFamily: "var(--font-display)", color: "var(--text)" }}
      >
        Matchups
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Head-to-head clip battles. Vote on the current round&apos;s winner.
      </p>

      {error && (
        <p
          className="rounded-lg p-3 text-sm"
          style={{ background: "var(--red-soft)", color: "var(--red)" }}
        >
          Failed to load bouts: {error.message}
        </p>
      )}

      {!error && (!bouts || bouts.length === 0) && (
        <p style={{ color: "var(--text-faint)" }}>No bouts yet.</p>
      )}

      <div className="bc-card flex flex-col overflow-hidden">
        {bouts?.map((bout: Bout, i: number) => {
          const tally = tallies[bout.id] ?? { a: 0, b: 0 };
          const total = tally.a + tally.b;
          const pctA = total > 0 ? Math.round((tally.a / total) * 100) : 0;
          const pctB = total > 0 ? 100 - pctA : 0;
          const sponsorName = bout.sponsors?.name ?? bout.categories?.sponsors?.name;

          return (
            <Link
              key={bout.id}
              href={`/bout/${bout.id}`}
              className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-[var(--surface-2)]"
              style={{
                borderTop: i > 0 ? "1px solid var(--border)" : "none",
              }}
            >
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] text-lg"
                style={{ background: "var(--surface-2)" }}
              >
                {getCategoryIcon(bout.categories?.name)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <span>{bout.competitor_a_name}</span>
                  <span style={{ color: "var(--text-faint)" }}>vs</span>
                  <span>{bout.competitor_b_name}</span>
                  {bout.bracket_key && (
                    <span
                      className="bc-badge-gold rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                    >
                      🏆 Round {bout.round_number}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs" style={{ color: "var(--text-faint)" }}>
                  <span className="font-semibold" style={{ color: "var(--text-dim)" }}>
                    {bout.categories?.name ?? "Uncategorized"}
                  </span>
                  {sponsorName && <span> · Presented by {sponsorName}</span>}
                </div>
                {poolByBout.has(bout.id) && (() => {
                  const pool = poolByBout.get(bout.id)!;
                  const pct = Math.min(100, Math.round((pool.raised / pool.goal_amount) * 100));
                  return (
                    <div className="mt-2 flex max-w-[300px] items-center gap-2">
                      <span className="whitespace-nowrap text-[11px] font-bold" style={{ color: "var(--text-dim)" }}>
                        🪙 {pool.raised} of {pool.goal_amount} BB
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--blue)" }} />
                      </div>
                      <StopPropagation>
                        <ContributeButton poolId={pool.id} compact />
                      </StopPropagation>
                    </div>
                  );
                })()}
              </div>

              <div className="flex flex-shrink-0 flex-col items-end gap-1">
                <span
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    fontFamily: "var(--font-display)",
                    background:
                      bout.status === "live"
                        ? "var(--red-soft)"
                        : bout.status === "final"
                        ? "var(--gold-soft)"
                        : "var(--surface-2)",
                    color:
                      bout.status === "live"
                        ? "var(--red)"
                        : bout.status === "final"
                        ? "var(--gold)"
                        : "var(--text-dim)",
                  }}
                >
                  {bout.status === "live" && <span className="bc-live-dot mr-1" />}
                  {STATUS_LABEL[bout.status]}
                </span>
                {total > 0 ? (
                  <span
                    className="text-xs font-variant-tabular"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {pctA}% / {pctB}%
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                    No votes yet
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
