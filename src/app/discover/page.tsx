import type { Metadata } from "next";
import Link from "next/link";
import JoinBox from "@/components/JoinBox";
import MatchupsView from "@/components/browse/MatchupsView";
import LiveEventsView from "@/components/browse/LiveEventsView";
import { createClient } from "@/lib/supabase/server";
import { getCategoryIcon } from "@/lib/categoryIcon";

type View = "browse" | "matchups" | "events";
const VIEWS: { key: View; label: string }[] = [
  { key: "browse", label: "Browse" },
  { key: "matchups", label: "Live matchups" },
  { key: "events", label: "Live events" },
];
const TITLES: Record<View, { title: string; description: string }> = {
  browse: { title: "Discover", description: "Browse matchups, brackets, showcases, debates and live events by category." },
  matchups: { title: "Matchups — vote on today’s bouts", description: "Head-to-head band battles, dance-offs and showdowns live right now. Watch both sides and vote for who won." },
  events: { title: "Live events — happening now", description: "Vote in live polls, elections, talent shows and battles happening on BoutCasts right now." },
};
const viewOf = (v?: string): View => (v === "matchups" || v === "events" ? v : "browse");

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ view?: string }> }): Promise<Metadata> {
  const { view } = await searchParams;
  const m = TITLES[viewOf(view)];
  return { title: m.title, description: m.description };
}

// One place to browse everything fans can watch and vote on.
const FORMATS = [
  { href: "/debates", icon: "🎙️", title: "Debates", body: "Video arguments in rounds. Vote for who made the case." },
  { href: "/competitions", icon: "🏟️", title: "Competitions", body: "Hubs run by schools, leagues and organizers." },
  { href: "/leaderboard", icon: "🏆", title: "Leaderboard", body: "Top voters and competitors by points." },
  { href: "/boutcard", icon: "🎟️", title: "BoutCard", body: "Today's featured bout and the full bracket." },
];

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ view?: string; category?: string }> }) {
  const { view: viewParam, category } = await searchParams;
  const view = viewOf(viewParam);
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
        {view === "matchups" ? "Live matchups" : view === "events" ? "Live events" : "Discover"}
      </h1>
      <p className="mb-5 text-sm" style={{ color: "var(--text-dim)" }}>
        {view === "matchups"
          ? "Head-to-head clip battles. Vote on the current round's winner."
          : view === "events"
            ? "Happening now: polls, elections and shows open to everyone."
            : "Find something to watch and vote on."}
      </p>

      <nav aria-label="Browse" className="mb-6 flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link key={v.key} href={v.key === "browse" ? "/discover" : `/discover?view=${v.key}`} className={`bc-chip${view === v.key ? " active" : ""}`}>
            {v.label}
          </Link>
        ))}
      </nav>

      {view === "matchups" && <MatchupsView />}
      {view === "events" && <LiveEventsView categoryFilter={category} />}
      {view === "browse" && (
        <>

      <form action="/search" className="mb-8 flex gap-2">
        <input
          name="q"
          placeholder="Search bands, schools, people, events…"
          className="min-w-0 flex-1 rounded-full border px-4 py-2.5 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        />
        <button className="bc-btn-solid rounded-full px-5 text-sm font-bold">Search</button>
      </form>

      <div className="bc-card mb-8 p-4">
        <span className="block font-bold">🔒 Have a code or a link?</span>
        <span className="mb-3 block text-sm" style={{ color: "var(--text-dim)" }}>
          School, private and game codes don&apos;t show up here. Enter yours to join. No account needed.
        </span>
        <JoinBox compact />
      </div>

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
        </>
      )}
    </div>
  );
}
