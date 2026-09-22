import { createClient } from "@/lib/supabase/server";
import BracketBuilder from "@/components/BracketBuilder";
import BoutCurator from "@/components/BoutCurator";

export default async function AdminBoutsPage() {
  const supabase = await createClient();

  const [{ data: categories }, { data: submissionsRaw }, { data: usedRows }, { data: sponsors }, { data: bouts }] =
    await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase
        .from("submissions")
        .select("id, title, category_id, crew_name, source_type, source_url, created_at, profiles(username)")
        .eq("status", "approved")
        .order("created_at", { ascending: true }),
      supabase
        .from("bouts")
        .select("competitor_a_submission_id, competitor_b_submission_id"),
      supabase.from("sponsors").select("id, name").order("name"),
      supabase.from("bouts").select("*").order("created_at", { ascending: false }),
    ]);

  const usedIds = new Set<string>();
  for (const b of usedRows ?? []) {
    if (b.competitor_a_submission_id) usedIds.add(b.competitor_a_submission_id);
    if (b.competitor_b_submission_id) usedIds.add(b.competitor_b_submission_id);
  }

  const submissions = (submissionsRaw ?? []).map((s) => ({
    ...s,
    used: usedIds.has(s.id),
  }));

  const boutIds = (bouts ?? []).map((b) => b.id);
  const { data: votesRaw } =
    boutIds.length > 0
      ? await supabase.from("votes").select("bout_id, side").in("bout_id", boutIds)
      : { data: [] as { bout_id: string; side: string }[] };

  const tallyByBout = new Map<string, { a: number; b: number }>();
  for (const v of votesRaw ?? []) {
    const t = tallyByBout.get(v.bout_id) ?? { a: 0, b: 0 };
    t[v.side as "a" | "b"]++;
    tallyByBout.set(v.bout_id, t);
  }

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Bouts &amp; brackets
      </h2>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Curate individual bouts directly, or turn a set of approved submissions into a bracket.
      </p>

      <BoutCurator
        initialBouts={bouts ?? []}
        categories={categories ?? []}
        sponsors={sponsors ?? []}
        submissions={submissions}
        tallyByBout={Object.fromEntries(tallyByBout)}
      />

      <h2 className="mb-1 mt-12 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Build a bracket
      </h2>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Turn a power-of-two set of approved submissions into a full tournament bracket.
      </p>
      <BracketBuilder categories={categories ?? []} submissions={submissions as never} />
    </div>
  );
}
