import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Bout } from "@/lib/types";
import FeaturedBout from "@/components/FeaturedBout";
import BracketTree from "@/components/BracketTree";

// The "BoutCard" landing page — mirrors the concept mockup's default view:
// a featured live duel up top, its tournament bracket underneath, with a
// way to jump into the full flat feed of every other matchup.
export default async function Home() {
  const supabase = await createClient();

  // Feature the most relevant bout: a live one first, then the next
  // upcoming one, then just whatever's most recent.
  const { data: liveBout } = await supabase
    .from("bouts")
    .select("id, bracket_key, categories(name)")
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  type FeaturedRow = { id: string; bracket_key: string | null; categories: { name: string }[] | { name: string } | null };
  function categoryName(categories: FeaturedRow["categories"]): string | null {
    if (!categories) return null;
    return Array.isArray(categories) ? categories[0]?.name ?? null : categories.name ?? null;
  }

  let featured = liveBout as FeaturedRow | null;
  if (!featured) {
    const { data: upcoming } = await supabase
      .from("bouts")
      .select("id, bracket_key, categories(name)")
      .eq("status", "upcoming")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    featured = upcoming as FeaturedRow | null;
  }
  if (!featured) {
    const { data: any } = await supabase
      .from("bouts")
      .select("id, bracket_key, categories(name)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    featured = any as FeaturedRow | null;
  }

  let bracketBouts: Bout[] = [];
  if (featured?.bracket_key) {
    const { data: boutsRaw } = await supabase
      .from("bouts")
      .select("*, categories(name)")
      .eq("bracket_key", featured.bracket_key)
      .order("round_number", { ascending: true })
      .order("created_at", { ascending: true });
    bracketBouts = (boutsRaw as Bout[]) ?? [];
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-5 flex items-center justify-center gap-2 text-center text-xs" style={{ color: "var(--text-faint)" }}>
        <span>New here?</span>
        <Link href="/how-it-works" className="font-semibold underline" style={{ color: "var(--blue)" }}>
          See how BoutCasts works →
        </Link>
      </div>

      {!featured && (
        <div className="bc-card p-8 text-center" style={{ color: "var(--text-faint)" }}>
          No bouts yet.{" "}
          <Link href="/submit" className="font-semibold underline" style={{ color: "var(--blue)" }}>
            Submit the first one
          </Link>
          .
        </div>
      )}

      {featured && (
        <>
          <FeaturedBout boutId={featured.id} />

          {bracketBouts.length > 0 && featured.bracket_key && (
            <section className="mt-8">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
                  {categoryName(featured.categories) ?? "Bracket"}
                </h2>
                <Link
                  href={`/bracket/${featured.bracket_key}`}
                  className="text-xs font-semibold"
                  style={{ color: "var(--blue)" }}
                >
                  Full bracket →
                </Link>
              </div>
              <p className="mb-4 text-xs" style={{ color: "var(--text-faint)" }}>
                Tournament bracket — winners advance automatically when voting closes.
              </p>
              <div className="bc-card p-5">
                <BracketTree bouts={bracketBouts} bracketKey={featured.bracket_key} />
              </div>
            </section>
          )}

          <div className="mt-8 text-center">
            <Link
              href="/matchups"
              className="rounded-full border px-5 py-2.5 text-sm font-bold"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
            >
              Browse all matchups →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
