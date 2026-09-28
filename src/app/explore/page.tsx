import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Explore Live Votes",
  description:
    "Vote in live polls, elections, talent shows and battles happening on BoutCasts right now — or start your own.",
  openGraph: {
    title: "Explore Live Votes on BoutCasts",
    description: "Vote in live polls, elections, talent shows and battles happening right now.",
  },
};

type ExploreRow = {
  id: string;
  title: string;
  description: string | null;
  status: "live" | "closed";
  closes_at: string | null;
  brand_name: string | null;
  brand_logo_url: string | null;
  scoring_mode: "crowd" | "judges";
  voting_method: "single" | "ranked";
  option_count: number;
  vote_count: number;
  cover_url: string | null;
  category_id: string | null;
  category_name: string | null;
  subcategory_name: string | null;
};

function timeLeft(closesAt: string | null, now: number): string | null {
  if (!closesAt) return null;
  const ms = new Date(closesAt).getTime() - now;
  if (ms <= 0) return "Closing now";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `Closes in ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `Closes in ${hours} hr${hours === 1 ? "" : "s"}`;
  return `Closes in ${Math.round(hours / 24)} days`;
}

function EventCard({ e, now }: { e: ExploreRow; now: number }) {
  const live = e.status === "live";
  const image = e.cover_url ?? e.brand_logo_url;
  const kind = e.scoring_mode === "judges" ? "Judged" : e.voting_method === "ranked" ? "Ranked choice" : "Crowd vote";
  const left = live ? timeLeft(e.closes_at, now) : null;

  return (
    <Link
      href={`/vote/${e.id}`}
      className="group flex min-w-0 gap-3 rounded-xl border p-3 transition-colors hover:border-[var(--red)]"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div
        className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-2xl font-bold"
            style={{ fontFamily: "var(--font-display)", color: "var(--red)" }}
            aria-hidden
          >
            {(e.title.match(/[a-z0-9]/i)?.[0] ?? "★").toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide">
          <span style={{ color: live ? "var(--live)" : "var(--text-faint)" }}>{live ? "● Live" : "Closed"}</span>
          <span style={{ color: "var(--text-faint)" }}>· {kind}</span>
        </div>
        <p className="truncate font-semibold group-hover:underline">{e.title}</p>
        {e.category_name && (
          <p className="truncate text-[11px] font-semibold" style={{ color: "var(--red)" }}>
            {e.category_name}
            {e.subcategory_name ? ` › ${e.subcategory_name}` : ""}
          </p>
        )}
        {e.brand_name && (
          <p className="truncate text-xs" style={{ color: "var(--text-dim)" }}>
            Presented by {e.brand_name}
          </p>
        )}
        <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
          {e.option_count} option{e.option_count === 1 ? "" : "s"}
          {e.scoring_mode === "crowd" && ` · ${Number(e.vote_count).toLocaleString()} vote${Number(e.vote_count) === 1 ? "" : "s"}`}
          {left && ` · ${left}`}
        </p>
      </div>
    </Link>
  );
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: categoryFilter } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_explore_live_votes", { p_limit: 60 });
  const rows = (data ?? []) as ExploreRow[];

  // Public competition hubs with matchups live right now.
  const { data: liveBouts } = await supabase.from("bouts").select("category_id").eq("status", "live").limit(500);
  const liveByCat = new Map<string, number>();
  for (const b of liveBouts ?? []) if (b.category_id) liveByCat.set(b.category_id, (liveByCat.get(b.category_id) ?? 0) + 1);
  const { data: hubRows } = liveByCat.size
    ? await supabase
        .from("categories")
        .select("id, name, hub_color, sponsors(name)")
        .in("id", [...liveByCat.keys()])
        .eq("is_listed", true)
    : { data: [] };
  const hubs = ((hubRows ?? []) as unknown as { id: string; name: string; hub_color: string | null; sponsors: { name: string } | null }[])
    .map((h) => ({ ...h, live: liveByCat.get(h.id) ?? 0 }))
    .sort((a, b) => b.live - a.live)
    .slice(0, 12);
  // Category chips: only categories that currently have listed events.
  const catChips = Array.from(
    new Map(rows.filter((r) => r.category_id && r.category_name).map((r) => [r.category_id as string, r.category_name as string])).entries()
  );
  const shown = categoryFilter ? rows.filter((r) => r.category_id === categoryFilter) : rows;
  const live = shown.filter((r) => r.status === "live");
  const closed = shown.filter((r) => r.status === "closed");
  // Server-rendered per request, so reading the clock here is intentional.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "var(--red)" }}>
        Explore
      </p>
      <h1 className="mb-2 text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Live votes happening now
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-dim)" }}>
        Polls, elections, talent shows and battles that organizers have opened to everyone. Tap one
        to watch the tally and cast your vote.
      </p>

      {catChips.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link href="/explore" className={`bc-chip${!categoryFilter ? " active" : ""}`}>
            All
          </Link>
          {catChips.map(([id, name]) => (
            <Link key={id} href={`/explore?category=${id}`} className={`bc-chip${categoryFilter === id ? " active" : ""}`}>
              {name}
            </Link>
          ))}
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
          Live now {live.length > 0 && `(${live.length})`}
        </h2>
        {live.length === 0 ? (
          <div
            className="rounded-xl border p-5 text-center"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <p className="font-semibold">Nothing live on Explore right now.</p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-faint)" }}>
              Many events are private to their school or group. Running one of your own?
            </p>
            <Link href="/live-vote/new" className="bc-btn-solid mt-3 inline-block rounded-full px-5 py-2.5 text-sm font-bold">
              Start a Live Vote
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {live.map((e) => (
              <EventCard key={e.id} e={e} now={now} />
            ))}
          </div>
        )}
      </section>

      {hubs.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            Competitions with live matchups
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {hubs.map((h) => (
              <Link
                key={h.id}
                href={`/c/${h.id}`}
                className="flex min-w-0 items-center gap-3 rounded-xl border p-3 hover:border-[var(--red)]"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <span className="h-12 w-2 shrink-0 rounded-full" style={{ background: h.hub_color ?? "var(--red)" }} aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{h.sponsors?.name ? `The ${h.sponsors.name} ${h.name}` : h.name}</span>
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                    {h.live} matchup{h.live === 1 ? "" : "s"} live
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {closed.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            Recently closed
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {closed.map((e) => (
              <EventCard key={e.id} e={e} now={now} />
            ))}
          </div>
        </section>
      )}

      {live.length > 0 && (
        <div
          className="rounded-xl border p-4 text-center"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <p className="font-semibold">Want the crowd to decide something?</p>
          <Link href="/live-vote/new" className="bc-btn-solid mt-3 inline-block rounded-full px-5 py-2.5 text-sm font-bold">
            Start a Live Vote
          </Link>
        </div>
      )}
    </div>
  );
}
