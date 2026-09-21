import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bout } from "./types";

export type RoundRecapBout = {
  id: string;
  title: string;
  competitor_a_name: string;
  competitor_b_name: string;
  winner_side: "a" | "b" | null;
  tally_a: number;
  tally_b: number;
  next_bout_id: string | null;
};

export type RoundRecap = {
  bracketKey: string;
  roundNumber: number;
  categoryName: string;
  sponsorName: string | null;
  isComplete: boolean;
  bouts: RoundRecapBout[];
  totalVotes: number;
};

/** Shared by the recap page and its opengraph-image so both agree on the data. */
export async function getRoundRecap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  bracketKey: string,
  roundNumber: number
): Promise<RoundRecap | null> {
  const { data: bouts } = await supabase
    .from("bouts")
    .select("*, categories(name, sponsor_id, sponsors(name))")
    .eq("bracket_key", bracketKey)
    .eq("round_number", roundNumber);

  if (!bouts || bouts.length === 0) return null;

  const boutIds = bouts.map((b) => b.id);
  const { data: votes } = await supabase
    .from("votes")
    .select("bout_id, side")
    .in("bout_id", boutIds);

  const tallies: Record<string, { a: number; b: number }> = {};
  for (const v of votes ?? []) {
    if (!tallies[v.bout_id]) tallies[v.bout_id] = { a: 0, b: 0 };
    tallies[v.bout_id][v.side as "a" | "b"]++;
  }

  const isComplete = bouts.every((b) => b.status === "final");
  let totalVotes = 0;
  const recapBouts: RoundRecapBout[] = bouts.map((b) => {
    const t = tallies[b.id] ?? { a: 0, b: 0 };
    totalVotes += t.a + t.b;
    return {
      id: b.id,
      title: b.title,
      competitor_a_name: b.competitor_a_name,
      competitor_b_name: b.competitor_b_name,
      winner_side: b.winner_side,
      tally_a: t.a,
      tally_b: t.b,
      next_bout_id: b.next_bout_id,
    };
  });

  const first = bouts[0] as Bout;

  return {
    bracketKey,
    roundNumber,
    categoryName: first.categories?.name ?? "Bracket",
    sponsorName: first.categories?.sponsors?.name ?? null,
    isComplete,
    bouts: recapBouts,
    totalVotes,
  };
}

export function roundLabelFor(roundNumber: number, lastRound: number) {
  if (roundNumber === lastRound) return "Final";
  if (roundNumber === lastRound - 1) return "Semifinal";
  if (roundNumber === lastRound - 2) return "Quarterfinal";
  return `Round ${roundNumber}`;
}
