import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRoundRecap, roundLabelFor } from "@/lib/recap";
import VersusCard from "@/components/VersusCard";

export default async function RoundRecapPage({
  params,
}: {
  params: Promise<{ key: string; round: string }>;
}) {
  const { key, round } = await params;
  const roundNumber = Number(round);
  const supabase = await createClient();

  const recap = await getRoundRecap(supabase, key, roundNumber);
  if (!recap) {
    notFound();
  }

  const { data: allBouts } = await supabase
    .from("bouts")
    .select("round_number")
    .eq("bracket_key", key);
  const lastRound = Math.max(
    roundNumber,
    ...(allBouts ?? []).map((b) => b.round_number)
  );
  const label = roundLabelFor(roundNumber, lastRound);

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link
        href={`/bracket/${key}`}
        className="mb-4 inline-block text-sm font-semibold"
        style={{ color: "var(--blue)" }}
      >
        &larr; Back to bracket
      </Link>

      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        🎬 {label} Recap
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        {recap.categoryName}
        {recap.sponsorName && <> · Presented by {recap.sponsorName}</>}
      </p>

      {!recap.isComplete && (
        <p
          className="mb-5 rounded-lg p-3 text-sm"
          style={{ background: "var(--gold-soft)", color: "var(--gold)" }}
        >
          This round is still in progress — the recap fills in as bouts close.
        </p>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {recap.bouts.map((b) => {
          const total = b.tally_a + b.tally_b;
          const pctA = total > 0 ? Math.round((b.tally_a / total) * 100) : 0;
          const pctB = total > 0 ? 100 - pctA : 0;
          return (
            <Link key={b.id} href={`/bout/${b.id}`} className="block transition hover:brightness-105">
              <VersusCard
                categoryName={recap.categoryName}
                levelText={`${label} · ${b.title}`}
                sponsorName={recap.sponsorName}
                aName={b.competitor_a_name}
                aPct={pctA}
                bName={b.competitor_b_name}
                bPct={pctB}
                winnerSide={b.winner_side}
              />
            </Link>
          );
        })}
      </div>

      <div
        className="flex items-center justify-between border-t pt-4 text-sm"
        style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}
      >
        <span>{recap.totalVotes} total votes cast this round</span>
        <Link href={`/bracket/${key}`} className="font-semibold" style={{ color: "var(--red)" }}>
          View full bracket →
        </Link>
      </div>
    </div>
  );
}
