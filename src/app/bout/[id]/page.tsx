import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VotePanel from "@/components/VotePanel";

export default async function BoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: bout } = await supabase
    .from("bouts")
    .select("*, categories(name)")
    .eq("id", id)
    .maybeSingle();

  if (!bout) {
    notFound();
  }

  const { data: votes } = await supabase
    .from("votes")
    .select("side")
    .eq("bout_id", id);

  const tally = { a: 0, b: 0 };
  for (const v of votes ?? []) {
    tally[v.side as "a" | "b"]++;
  }

  const votingOpen = bout.status !== "final";

  let nextBoutTitle: string | null = null;
  if (bout.next_bout_id) {
    const { data: nextBout } = await supabase
      .from("bouts")
      .select("title")
      .eq("id", bout.next_bout_id)
      .maybeSingle();
    nextBoutTitle = nextBout?.title ?? null;
  }

  const winnerName =
    bout.winner_side === "a"
      ? bout.competitor_a_name
      : bout.winner_side === "b"
      ? bout.competitor_b_name
      : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/" className="mb-4 inline-block text-sm text-neutral-500 hover:underline">
        &larr; Back to bouts
      </Link>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase text-neutral-500">
            {bout.categories?.name ?? "Uncategorized"}
            {bout.bracket_key && (
              <>
                {" · "}
                <Link href={`/bracket/${bout.bracket_key}`} className="underline hover:text-red-600">
                  Round {bout.round_number} · View bracket
                </Link>
              </>
            )}
          </span>
          <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-bold text-white uppercase">
            {bout.status}
          </span>
        </div>

        <h1 className="mb-1 text-xl font-bold">{bout.title}</h1>

        <div className="mb-4 flex items-center justify-center gap-4 py-4 text-lg font-bold">
          <span className={bout.winner_side === "a" ? "text-green-700" : ""}>
            {bout.competitor_a_name}
            {bout.winner_side === "a" && " 🏆"}
          </span>
          <span className="text-neutral-400">VS</span>
          <span className={bout.winner_side === "b" ? "text-green-700" : ""}>
            {bout.competitor_b_name}
            {bout.winner_side === "b" && " 🏆"}
          </span>
        </div>

        {bout.status === "final" && winnerName && (
          <div className="mb-4 rounded bg-green-50 p-3 text-center text-sm font-semibold text-green-800">
            {winnerName} wins this round
            {nextBoutTitle && <> — advances to &quot;{nextBoutTitle}&quot;</>}
          </div>
        )}

        {votingOpen && bout.closes_at && (
          <p className="mb-4 text-center text-xs text-neutral-400">
            Voting closes {new Date(bout.closes_at).toLocaleString()}
          </p>
        )}

        {bout.round_theme_name && (
          <div className="mb-4 rounded bg-neutral-100 p-3 text-sm">
            <div className="mb-1 font-semibold">Round theme: {bout.round_theme_name}</div>
          </div>
        )}

        {bout.round_theme_rules && (
          <div className="mb-6 rounded border border-neutral-200 p-3 text-sm text-neutral-600">
            <div className="mb-1 font-semibold text-neutral-800">Round rules</div>
            {bout.round_theme_rules}
          </div>
        )}

        <VotePanel
          boutId={bout.id}
          aName={bout.competitor_a_name}
          bName={bout.competitor_b_name}
          initialTally={tally}
          votingOpen={votingOpen}
        />
      </div>
    </div>
  );
}
