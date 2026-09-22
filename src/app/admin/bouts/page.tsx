import { createClient } from "@/lib/supabase/server";
import BracketBuilder from "@/components/BracketBuilder";

export default async function AdminBoutsPage() {
  const supabase = await createClient();

  const [{ data: categories }, { data: submissionsRaw }, { data: usedRows }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase
      .from("submissions")
      .select("id, title, category_id, crew_name, source_type, source_url, created_at, profiles(username)")
      .eq("status", "approved")
      .order("created_at", { ascending: true }),
    supabase
      .from("bouts")
      .select("competitor_a_submission_id, competitor_b_submission_id"),
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

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Bouts &amp; brackets
      </h2>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Turn approved submissions into a live bout or a full tournament bracket.
      </p>

      <BracketBuilder categories={categories ?? []} submissions={submissions as never} />
    </div>
  );
}
