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
          <span style={{ color: live ? "var(--red)" : "var(--text-faint)" }}>{live ? "● Live" : "Closed"}</span>
          <span style={{ color: "var(--text-faint)" }}>· {kind}</span>
        </div>
        <p className="truncate font-semibold group-hover:underline">{e.title}</p>
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

export default async function ExplorePage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_explore_live_votes", { p_limit: 60 });
  const rows = (data ?? []) as ExploreRow[];
  const live = rows.filter((r) => r.status === "live");
  const closed = rows.filter((r) => r.status === "closed");
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
