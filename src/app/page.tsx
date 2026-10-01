import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isPublicBout, PUBLIC_BOUT_FIELDS } from "@/lib/publicBouts";
import ShowcaseCards from "@/components/showcases/ShowcaseCards";

// Home: the fans' front door. Live contests first, one tap to vote, and a
// clear second door ("Host a vote") for organizers, which leads to /host.

export const metadata: Metadata = {
  title: { absolute: "BoutCasts — Vote on band battles, dance-offs, debates & live events" },
  description:
    "Watch head-to-head battles and live events and vote for who won. Band battles, dance-offs, debates and halftime shows. Or host your own vote, free.",
};

type BoutRow = {
  id: string;
  title: string;
  status: "upcoming" | "live" | "final";
  competitor_a_name: string;
  competitor_b_name: string;
  bracket_key: string | null;
  round_number: number;
  categories: { name: string } | { name: string }[] | null;
  bout_mode: "open" | "closed";
  competitor_a_submission_id: string | null;
  competitor_b_submission_id: string | null;
};

type LiveVoteRow = {
  id: string;
  title: string;
  status: "live" | "closed";
  vote_count: number;
  option_count: number;
  brand_name: string | null;
  category_name: string | null;
};

function catName(c: BoutRow["categories"]) {
  if (!c) return null;
  return Array.isArray(c) ? c[0]?.name ?? null : c.name;
}

async function loadData() {
  const supabase = await createClient();
  const [{ data: boutRows }, { data: lvRows }, { data: auth }] = await Promise.all([
    supabase
      .from("bouts")
      .select(`id, title, status, competitor_a_name, competitor_b_name, bracket_key, round_number, categories(name), ${PUBLIC_BOUT_FIELDS}`)
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .limit(24),
    supabase.rpc("get_explore_live_votes", { p_limit: 12 }),
    supabase.auth.getUser(),
  ]);
  const bouts = ((boutRows ?? []) as unknown as BoutRow[]).filter(isPublicBout).slice(0, 8);

  const tallies = new Map<string, number>();
  if (bouts.length) {
    const { data: votes } = await supabase.from("votes").select("bout_id").in("bout_id", bouts.map((b) => b.id));
    for (const v of votes ?? []) tallies.set(v.bout_id, (tallies.get(v.bout_id) ?? 0) + 1);
  }

  const liveVotes = ((lvRows ?? []) as LiveVoteRow[]).filter((r) => r.status === "live").slice(0, 4);

  let myEvents = 0;
  const user = auth.user;
  if (user) {
    const { count } = await supabase
      .from("live_vote_events")
      .select("id", { count: "exact", head: true })
      .eq("organizer_id", user.id)
      .neq("status", "closed");
    myEvents = count ?? 0;
  }
  return { bouts, tallies, liveVotes, signedIn: !!user, myEvents };
}

export default async function Home() {
  const { bouts, tallies, liveVotes, signedIn, myEvents } = await loadData();
  const firstBout = bouts[0];

  return (
    <div>
      {/* ===== Hero: two front doors ===== */}
      <section className="lp relative overflow-hidden" style={{ background: "var(--lp-ink)", color: "#fff" }}>
        <div aria-hidden className="lp-slash" style={{ opacity: 0.9 }} />
        <div className="relative mx-auto max-w-[1180px] px-5 pb-10 pt-8 sm:px-8 lg:pb-14 lg:pt-12">
          <div className="lp-eyebrow mb-3 flex items-center gap-2.5" style={{ color: "#9fb8ff" }}>
            <span className="lp-live-dot" aria-hidden /> {bouts.length + liveVotes.length > 0 ? `${bouts.length + liveVotes.length} live now` : "Live voting"}
          </div>
          <h1 className="lp-display max-w-[760px] text-[44px] sm:text-[64px] lg:text-[80px]" style={{ lineHeight: 0.92 }}>
            Who won? <span style={{ color: "var(--lp-blue-light)" }}>You decide.</span>
          </h1>
          <p className="mt-4 max-w-[560px] text-[16px] leading-relaxed sm:text-[18px]" style={{ color: "#c9d0e0" }}>
            Band battles, dance-offs, debates and halftime showdowns, decided by the crowd. Watch, vote and share your pick.
          </p>

          <div className="mt-7 grid max-w-[760px] gap-3 sm:grid-cols-2">
            <Link
              href={firstBout ? `/bout/${firstBout.id}` : "/discover"}
              className="group rounded-2xl p-5 transition-transform hover:-translate-y-0.5"
              style={{ background: "#fff", color: "var(--lp-ink)" }}
            >
              <div className="text-[12px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--lp-blue)" }}>
                For fans
              </div>
              <div className="lp-title mt-1 text-[22px] leading-tight">Watch &amp; vote →</div>
              <div className="mt-1 text-sm" style={{ color: "#5a6275" }}>
                No account needed for your first vote.
              </div>
            </Link>
            <Link
              href={myEvents > 0 ? "/live-vote" : "/host"}
              className="group rounded-2xl border-2 p-5 transition-transform hover:-translate-y-0.5"
              style={{ borderColor: "rgba(255,255,255,0.4)", color: "#fff" }}
            >
              <div className="text-[12px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#9fb8ff" }}>
                For schools, leagues &amp; events
              </div>
              <div className="lp-title mt-1 text-[22px] leading-tight">
                {myEvents > 0 ? `Your events (${myEvents}) →` : "Host a vote →"}
              </div>
              <div className="mt-1 text-sm" style={{ color: "#c9d0e0" }}>
                {myEvents > 0 ? "Manage voting, results and judges." : "Elections, halftime polls, talent shows. Free to start."}
              </div>
            </Link>
          </div>
          <p className="mt-5 text-sm" style={{ color: "#9aa3b8" }}>
            Got a code from your school or event?{" "}
            <Link href="/join" className="font-bold underline" style={{ color: "#fff" }}>
              Join a private event
            </Link>
          </p>
          {!signedIn && (
            <p className="mt-2 text-sm" style={{ color: "#9aa3b8" }}>
              Already on BoutCasts?{" "}
              <Link href="/login" className="font-bold underline" style={{ color: "#fff" }}>
                Log in
              </Link>
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8">
        {/* ===== Live bouts ===== */}
        <section id="live" className="mb-10">
          <SectionHead title="Live matchups" href="/matchups" linkLabel="See all" />
          {bouts.length === 0 ? (
            <EmptyCard text="No matchups are live right now. Check back soon, or start your own." href="/create" cta="Create" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {bouts.map((b) => (
                <Link
                  key={b.id}
                  href={`/bout/${b.id}`}
                  className="bc-card flex min-w-0 flex-col gap-3 p-4 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wide">
                    <span className="truncate" style={{ color: "var(--text-faint)" }}>
                      {catName(b.categories) ?? "Matchup"}
                      {b.bracket_key ? ` · Round ${b.round_number}` : ""}
                    </span>
                    <span className="flex flex-shrink-0 items-center gap-1.5" style={{ color: "var(--live, #e5263b)" }}>
                      <span className="bc-live-dot" /> Live
                    </span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                    <span className="line-clamp-2 text-sm font-bold">{b.competitor_a_name}</span>
                    <span className="text-[11px] font-black" style={{ color: "var(--text-faint)", fontFamily: "var(--font-display)" }}>
                      VS
                    </span>
                    <span className="line-clamp-2 text-right text-sm font-bold">{b.competitor_b_name}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--text-faint)" }}>
                      {(tallies.get(b.id) ?? 0).toLocaleString()} {tallies.get(b.id) === 1 ? "vote" : "votes"}
                    </span>
                    <span className="font-bold" style={{ color: "var(--red)" }}>
                      Vote →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ===== Showcases & panel debates ===== */}
        <ShowcaseCards heading="Showcases — one video, pick your favorite" limit={3} />

        {/* ===== Public Live Votes ===== */}
        {liveVotes.length > 0 && (
          <section className="mb-10">
            <SectionHead title="Live events" href="/explore" linkLabel="See all" />
            <div className="grid gap-3 sm:grid-cols-2">
              {liveVotes.map((e) => (
                <Link
                  key={e.id}
                  href={`/vote/${e.id}`}
                  className="bc-card flex min-w-0 items-center justify-between gap-3 p-4 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
                      {e.brand_name ?? e.category_name ?? "Live Vote"}
                    </span>
                    <span className="block truncate font-bold">{e.title}</span>
                    <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                      {e.option_count} options · {e.vote_count.toLocaleString()} votes
                    </span>
                  </span>
                  <span className="flex-shrink-0 text-sm font-bold" style={{ color: "var(--red)" }}>
                    Vote →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ===== Organizer door ===== */}
        <section
          className="mb-10 grid items-center gap-6 rounded-3xl p-6 sm:p-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
          style={{ background: "#1b4fe4", color: "#fff" }}
        >
          <div>
            <div className="text-[12px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#c7d6ff" }}>
              Host a vote
            </div>
            <h2 className="mt-1 text-2xl font-black leading-tight sm:text-3xl" style={{ fontFamily: "var(--font-display)" }}>
              Running a show, election or game?
            </h2>
            <p className="mt-2 text-sm sm:text-base" style={{ color: "#dfe6ff" }}>
              One link for your crowd, one fair vote each, and a live tally for the big screen.
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            {[
              ["🗳️", "Class & homecoming elections"],
              ["🎺", "Halftime & band battle crowd votes"],
              ["🎤", "Talent shows, step shows & dance-offs"],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-2.5 text-sm font-semibold">
                <span aria-hidden>{icon}</span> {text}
              </div>
            ))}
            <div className="mt-2 flex flex-wrap gap-2">
              <Link href="/live-vote/new" className="rounded-full px-5 py-2.5 text-sm font-bold" style={{ background: "#fff", color: "#0a0e1a" }}>
                Start free
              </Link>
              <Link href="/host" className="rounded-full border-2 px-5 py-2.5 text-sm font-bold" style={{ borderColor: "rgba(255,255,255,0.5)" }}>
                See how it works
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionHead({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </h2>
      <Link href={href} className="text-sm font-semibold" style={{ color: "var(--red)" }}>
        {linkLabel} →
      </Link>
    </div>
  );
}

function EmptyCard({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="bc-card flex flex-wrap items-center justify-between gap-3 p-5 text-sm" style={{ color: "var(--text-dim)" }}>
      {text}
      <Link href={href} className="font-bold" style={{ color: "var(--red)" }}>
        {cta} →
      </Link>
    </div>
  );
}
