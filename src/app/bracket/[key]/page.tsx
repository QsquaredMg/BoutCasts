import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Bout } from "@/lib/types";

export default async function BracketPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const supabase = await createClient();

  const { data: bouts } = await supabase
    .from("bouts")
    .select("*, categories(name)")
    .eq("bracket_key", key)
    .order("round_number", { ascending: true });

  if (!bouts || bouts.length === 0) {
    notFound();
  }

  const rounds = new Map<number, Bout[]>();
  for (const b of bouts as Bout[]) {
    const list = rounds.get(b.round_number) ?? [];
    list.push(b);
    rounds.set(b.round_number, list);
  }
  const roundNumbers = Array.from(rounds.keys()).sort((a, b) => a - b);
  const lastRound = roundNumbers[roundNumbers.length - 1];

  function roundLabel(n: number) {
    if (n === lastRound) return "Final";
    if (n === lastRound - 1) return "Semifinal";
    if (n === lastRound - 2) return "Quarterfinal";
    return `Round ${n}`;
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <Link href="/" className="mb-4 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>
        &larr; Back to matchups
      </Link>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        {(bouts[0] as Bout).categories?.name ?? "Bracket"}
      </h1>
      <p className="mb-8 text-sm" style={{ color: "var(--text-faint)" }}>
        Tournament bracket — winners advance automatically when voting closes.
      </p>

      <div className="flex gap-6 overflow-x-auto pb-4">
        {roundNumbers.map((rn) => (
          <div key={rn} className="flex min-w-[240px] flex-1 flex-col gap-4">
            <div
              className="text-center text-xs font-bold uppercase tracking-wide"
              style={{ fontFamily: "var(--font-display)", color: "var(--text-faint)" }}
            >
              {roundLabel(rn)}
            </div>
            <Link
              href={`/bracket/${key}/recap/${rn}`}
              className="text-center text-[11px] font-semibold"
              style={{ color: "var(--red)" }}
            >
              🎬 Round recap
            </Link>
            <div className="flex flex-1 flex-col justify-around gap-6">
              {(rounds.get(rn) ?? []).map((b) => (
                <Link
                  key={b.id}
                  href={`/bout/${b.id}`}
                  className="block overflow-hidden rounded-xl border text-sm transition"
                  style={{
                    borderColor:
                      b.status === "live"
                        ? "rgba(217,44,76,0.4)"
                        : rn === lastRound
                        ? "rgba(169,122,18,0.35)"
                        : "var(--border)",
                    background: "var(--surface)",
                  }}
                >
                  <div
                    className="flex items-center justify-between px-3 py-2.5"
                    style={{
                      background: b.winner_side === "a" ? "var(--gold-soft)" : "transparent",
                      color: b.winner_side === "a" ? "var(--gold)" : b.competitor_a_name ? "var(--text)" : "var(--text-faint)",
                      fontWeight: b.winner_side === "a" ? 700 : 500,
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <span>{b.competitor_a_name || "TBD"}</span>
                    {b.winner_side === "a" && <span>🏆</span>}
                  </div>
                  <div
                    className="flex items-center justify-between px-3 py-2.5"
                    style={{
                      background: b.winner_side === "b" ? "var(--gold-soft)" : "transparent",
                      color: b.winner_side === "b" ? "var(--gold)" : b.competitor_b_name ? "var(--text)" : "var(--text-faint)",
                      fontWeight: b.winner_side === "b" ? 700 : 500,
                    }}
                  >
                    <span>{b.competitor_b_name || "TBD"}</span>
                    {b.winner_side === "b" && <span>🏆</span>}
                  </div>
                  <div
                    className="px-3 py-1.5 text-center text-[10px] font-bold uppercase"
                    style={{
                      fontFamily: "var(--font-display)",
                      background: "var(--surface-2)",
                      color: b.status === "live" ? "var(--red)" : "var(--text-faint)",
                    }}
                  >
                    {b.status === "live" && <span className="bc-live-dot mr-1" />}
                    {b.status}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
