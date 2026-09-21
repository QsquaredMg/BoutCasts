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
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/" className="mb-4 inline-block text-sm text-neutral-500 hover:underline">
        &larr; Back to bouts
      </Link>
      <h1 className="mb-1 text-2xl font-bold">
        {(bouts[0] as Bout).categories?.name ?? "Bracket"}
      </h1>
      <p className="mb-8 text-neutral-500">Tournament bracket — winners advance automatically when voting closes.</p>

      <div className="flex gap-6 overflow-x-auto pb-4">
        {roundNumbers.map((rn) => (
          <div key={rn} className="flex min-w-[240px] flex-1 flex-col gap-4">
            <div className="text-center text-xs font-bold uppercase tracking-wide text-neutral-500">
              {roundLabel(rn)}
            </div>
            <div className="flex flex-1 flex-col justify-around gap-6">
              {(rounds.get(rn) ?? []).map((b) => (
                <Link
                  key={b.id}
                  href={`/bout/${b.id}`}
                  className={`block rounded-lg border p-3 text-sm shadow-sm transition hover:shadow ${
                    b.status === "final"
                      ? "border-neutral-300 bg-neutral-50"
                      : b.status === "live"
                      ? "border-red-300 bg-white"
                      : "border-dashed border-neutral-300 bg-white text-neutral-400"
                  }`}
                >
                  <div
                    className={`flex items-center justify-between rounded px-2 py-1 ${
                      b.winner_side === "a" ? "bg-green-100 font-bold" : ""
                    }`}
                  >
                    <span>{b.competitor_a_name || "TBD"}</span>
                    {b.winner_side === "a" && <span className="text-green-700">W</span>}
                  </div>
                  <div
                    className={`mt-1 flex items-center justify-between rounded px-2 py-1 ${
                      b.winner_side === "b" ? "bg-green-100 font-bold" : ""
                    }`}
                  >
                    <span>{b.competitor_b_name || "TBD"}</span>
                    {b.winner_side === "b" && <span className="text-green-700">W</span>}
                  </div>
                  <div className="mt-2 text-center text-[10px] uppercase text-neutral-400">
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
