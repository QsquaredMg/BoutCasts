import Link from "next/link";
import { isPublicBout, PUBLIC_BOUT_FIELDS } from "@/lib/publicBouts";
import { createClient } from "@/lib/supabase/server";

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

type LiveBout = {
  id: string;
  competitor_a_name: string;
  competitor_b_name: string;
  bracket_key: string | null;
  round_number: number;
  categories: { name: string } | { name: string }[] | null;
  bout_mode: "open" | "closed";
  competitor_a_submission_id: string | null;
  competitor_b_submission_id: string | null;
};

function boutCategory(c: LiveBout["categories"]) {
  if (!c) return null;
  return Array.isArray(c) ? (c[0]?.name ?? null) : c.name;
}

export default async function LiveEventsView({ categoryFilter }: { categoryFilter?: string }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_explore_live_votes", { p_limit: 60 });
  const rows = (data ?? []) as ExploreRow[];

  // Public head-to-head matchups live right now, so Explore is never empty while bouts are live.
  const { data: boutRows } = await supabase
    .from("bouts")
    .select(`id, competitor_a_name, competitor_b_name, bracket_key, round_number, categories(name), ${PUBLIC_BOUT_FIELDS}`)
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(24);
  const liveMatchups = ((boutRows ?? []) as unknown as LiveBout[]).filter(isPublicBout).slice(0, 6);

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
    <div>
      {catChips.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link href="/discover?view=events" className={`bc-chip${!categoryFilter ? " active" : ""}`}>
            All
          </Link>
          {catChips.map(([id, name]) => (
            <Link key={id} href={`/discover?view=events&category=${id}`} className={`bc-chip${categoryFilter === id ? " active" : ""}`}>
              {name}
            </Link>
          ))}
        </div>
      )}

      {liveMatchups.length > 0 && !categoryFilter && (
        <section className="mb-8">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
              Live matchups
            </h2>
            <Link href="/discover?view=matchups" className="text-xs font-bold" style={{ color: "var(--red)" }}>
              See all →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {liveMatchups.map((b) => (
              <Link
                key={b.id}
                href={`/bout/${b.id}`}
                className="flex min-w-0 flex-col gap-2 rounded-xl border p-3.5 hover:border-[var(--red)]"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <span className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wide">
                  <span className="truncate" style={{ color: "var(--text-faint)" }}>
                    {boutCategory(b.categories) ?? "Matchup"}
                    {b.bracket_key ? ` · Round ${b.round_number}` : ""}
                  </span>
                  <span className="flex flex-shrink-0 items-center gap-1.5" style={{ color: "var(--live, #e5263b)" }}>
                    <span className="bc-live-dot" /> Live
                  </span>
                </span>
                <span className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                  <span className="line-clamp-2 text-sm font-bold">{b.competitor_a_name}</span>
                  <span className="text-[11px] font-black" style={{ color: "var(--text-faint)", fontFamily: "var(--font-display)" }}>
                    VS
                  </span>
                  <span className="line-clamp-2 text-right text-sm font-bold">{b.competitor_b_name}</span>
                </span>
                <span className="text-xs font-bold" style={{ color: "var(--red)" }}>
                  Watch &amp; vote →
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
          Live votes {live.length > 0 && `(${live.length})`}
        </h2>
        {live.length === 0 ? (
          <div
            className="rounded-xl border p-5 text-center"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <p className="font-semibold">No public live votes right now.</p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-faint)" }}>
              Most elections and polls are private to their school or group{liveMatchups.length > 0 ? " — the matchups above are open to everyone" : ""}. Running
              one of your own?
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
