import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BracketBuilder from "@/components/BracketBuilder";

export default async function AdminBoutsPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-8">
        <p style={{ color: "var(--text-faint)" }}>You don&apos;t have access to this page.</p>
        <Link href="/matchups" className="text-sm font-semibold underline" style={{ color: "var(--red)" }}>
          Back to matchups
        </Link>
      </div>
    );
  }

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
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/matchups" className="mb-4 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>
        &larr; Back to matchups
      </Link>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Bouts &amp; brackets
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Turn approved submissions into a live bout or a full tournament bracket.
      </p>

      <BracketBuilder categories={categories ?? []} submissions={submissions as never} />
    </div>
  );
}
