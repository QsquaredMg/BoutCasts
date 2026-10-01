import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCategoryIcon } from "@/lib/categoryIcon";

export const metadata: Metadata = {
  title: "Discover",
  description: "Browse matchups, brackets, showcases, debates and live events by category.",
};

// One place to browse everything fans can watch and vote on.
const FORMATS = [
  { href: "/matchups", icon: "🥊", title: "Matchups & brackets", body: "Head-to-head clips. Pick a winner, watch them advance." },
  { href: "/debates", icon: "🎙️", title: "Debates", body: "Video arguments in rounds. Vote for who made the case." },
  { href: "/explore", icon: "🗳️", title: "Live events", body: "Public Live Votes happening right now." },
  { href: "/competitions", icon: "🏟️", title: "Competitions", body: "Hubs run by schools, leagues and organizers." },
  { href: "/leaderboard", icon: "🏆", title: "Leaderboard", body: "Top voters and competitors by points." },
  { href: "/boutcard", icon: "🎟️", title: "BoutCard", body: "Today's featured bout and the full bracket." },
];

export default async function DiscoverPage() {
  const supabase = await createClient();
  const [{ data: cats }, { data: live }] = await Promise.all([
    supabase.from("categories").select("id, name, description").eq("is_listed", true).order("sort_order", { ascending: true }).limit(60),
    supabase.from("bouts").select("category_id").eq("status", "live").limit(1000),
  ]);
  const liveByCat = new Map<string, number>();
  for (const b of live ?? []) if (b.category_id) liveByCat.set(b.category_id, (liveByCat.get(b.category_id) ?? 0) + 1);
  const categories = (cats ?? []).sort((a, b) => (liveByCat.get(b.id) ?? 0) - (liveByCat.get(a.id) ?? 0));

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-8">
      <h1 className="mb-1 text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Discover
      </h1>
      <p className="mb-5 text-sm" style={{ color: "var(--text-dim)" }}>
        Find something to watch and vote on.
      </p>

      <form action="/search" className="mb-8 flex gap-2">
        <input
          name="q"
          placeholder="Search bands, schools, people, events…"
          className="min-w-0 flex-1 rounded-full border px-4 py-2.5 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        />
        <button className="bc-btn-solid rounded-full px-5 text-sm font-bold">Search</button>
      </form>

      <Link
        href="/join"
        className="bc-card mb-8 flex items-center justify-between gap-3 p-4 transition-colors hover:bg-[var(--surface-2)]"
      >
        <span>
          <span className="block font-bold">🔒 Have an event code?</span>
          <span className="block text-sm" style={{ color: "var(--text-dim)" }}>
            School and private events don&apos;t show up here. Enter your code to join.
          </span>
        </span>
        <span className="flex-shrink-0 text-sm font-bold" style={{ color: "var(--red)" }}>
          Join →
        </span>
      </Link>

      <h2 className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
        Ways to vote
      </h2>
      <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FORMATS.map((f) => (
          <Link key={f.href} href={f.href} className="bc-card flex gap-3 p-4 transition-colors hover:bg-[var(--surface-2)]">
            <span className="text-2xl" aria-hidden>
              {f.icon}
            </span>
            <span className="min-w-0">
              <span className="block font-bold">{f.title}</span>
              <span className="block text-sm" style={{ color: "var(--text-dim)" }}>
                {f.body}
              </span>
            </span>
          </Link>
        ))}
      </div>

      {categories.length > 0 && (
        <>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            Categories
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((c) => {
              const n = liveByCat.get(c.id) ?? 0;
              return (
                <Link key={c.id} href={`/c/${c.id}`} className="bc-card flex min-w-0 flex-col gap-1 p-4 transition-colors hover:bg-[var(--surface-2)]">
                  <span className="text-2xl" aria-hidden>
                    {getCategoryIcon(c.name)}
                  </span>
                  <span className="truncate font-bold">{c.name}</span>
                  <span className="text-xs" style={{ color: n > 0 ? "var(--live, #e5263b)" : "var(--text-faint)" }}>
                    {n > 0 ? `${n} live now` : "Nothing live"}
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
