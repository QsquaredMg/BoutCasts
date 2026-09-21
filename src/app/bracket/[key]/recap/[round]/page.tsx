import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRoundRecap, roundLabelFor } from "@/lib/recap";

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
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/bracket/${key}`}
        className="mb-4 inline-block text-sm text-neutral-500 hover:underline"
      >
        &larr; Back to bracket
      </Link>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-1 text-xs font-semibold uppercase text-neutral-500">
          {recap.categoryName}
        </div>
        <h1 className="mb-1 text-2xl font-bold">{label} Recap</h1>
        {recap.sponsorName ? (
          <p className="mb-4 text-xs font-medium text-neutral-400">
            Presented by {recap.sponsorName}
          </p>
        ) : (
          <div className="mb-4" />
        )}

        {!recap.isComplete && (
          <p className="mb-4 rounded bg-amber-50 p-3 text-sm text-amber-800">
            This round is still in progress &mdash; the recap fills in as bouts close.
          </p>
        )}

        <div className="mb-6 flex flex-col gap-3">
          {recap.bouts.map((b) => {
            const winnerName =
              b.winner_side === "a"
                ? b.competitor_a_name
                : b.winner_side === "b"
                ? b.competitor_b_name
                : null;
            const loserName =
              b.winner_side === "a"
                ? b.competitor_b_name
                : b.winner_side === "b"
                ? b.competitor_a_name
                : null;
            const winnerTally = b.winner_side === "a" ? b.tally_a : b.tally_b;
            const loserTally = b.winner_side === "a" ? b.tally_b : b.tally_a;

            return (
              <div key={b.id} className="rounded-lg border border-neutral-200 p-3">
                <Link
                  href={`/bout/${b.id}`}
                  className="text-sm font-medium text-neutral-500 hover:underline"
                >
                  {b.title}
                </Link>
                {winnerName ? (
                  <div className="mt-1 font-semibold">
                    <span className="text-green-700">{winnerName} 🏆</span>{" "}
                    <span className="text-neutral-400">def.</span> {loserName}{" "}
                    <span className="text-neutral-400">
                      ({winnerTally}-{loserTally})
                    </span>
                  </div>
                ) : (
                  <div className="mt-1 text-sm text-neutral-400">Still voting...</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-neutral-100 pt-4 text-sm text-neutral-500">
          <span>{recap.totalVotes} total votes cast this round</span>
          <Link
            href={`/bracket/${key}`}
            className="font-medium text-red-600 hover:underline"
          >
            View full bracket &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
