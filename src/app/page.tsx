import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Bout } from "@/lib/types";

const STATUS_LABEL: Record<Bout["status"], string> = {
  live: "LIVE",
  upcoming: "UPCOMING",
  final: "FINAL",
};

const STATUS_STYLE: Record<Bout["status"], string> = {
  live: "bg-red-600 text-white",
  upcoming: "bg-neutral-300 text-neutral-800",
  final: "bg-neutral-800 text-white",
};

export default async function Home() {
  const supabase = await createClient();

  const { data: bouts, error } = await supabase
    .from("bouts")
    .select("*, categories(name)")
    .order("created_at", { ascending: false });

  const boutIds = (bouts ?? []).map((b) => b.id);
  const tallies: Record<string, { a: number; b: number }> = {};

  if (boutIds.length > 0) {
    const { data: votes } = await supabase
      .from("votes")
      .select("bout_id, side")
      .in("bout_id", boutIds);

    for (const v of votes ?? []) {
      if (!tallies[v.bout_id]) tallies[v.bout_id] = { a: 0, b: 0 };
      tallies[v.bout_id][v.side as "a" | "b"]++;
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">Bouts</h1>
      <p className="mb-6 text-neutral-500">
        Head-to-head clip battles. Vote on the current round&apos;s winner.
      </p>

      {error && (
        <p className="rounded bg-red-100 p-3 text-red-700">
          Failed to load bouts: {error.message}
        </p>
      )}

      {!error && (!bouts || bouts.length === 0) && (
        <p className="text-neutral-500">No bouts yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {bouts?.map((bout: Bout) => {
          const tally = tallies[bout.id] ?? { a: 0, b: 0 };
          const total = tally.a + tally.b;
          const pctA = total > 0 ? Math.round((tally.a / total) * 100) : 0;
          const pctB = total > 0 ? 100 - pctA : 0;

          return (
            <Link
              key={bout.id}
              href={`/bout/${bout.id}`}
              className="block rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-red-300 hover:shadow"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-neutral-500">
                  {bout.categories?.name ?? "Uncategorized"}
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[bout.status]}`}
                >
                  {STATUS_LABEL[bout.status]}
                </span>
              </div>
              <div className="mb-1 text-sm font-medium text-neutral-600">
                {bout.title}
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span>{bout.competitor_a_name}</span>
                <span className="text-neutral-400">vs</span>
                <span>{bout.competitor_b_name}</span>
              </div>
              {total > 0 ? (
                <div className="mt-3">
                  <div className="flex h-2 overflow-hidden rounded-full bg-neutral-200">
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${pctA}%` }}
                    />
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${pctB}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-neutral-500">
                    <span>{pctA}% ({tally.a})</span>
                    <span>{pctB}% ({tally.b})</span>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-xs text-neutral-400">No votes yet</div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
