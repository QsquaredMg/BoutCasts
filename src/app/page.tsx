import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isPublicBout, PUBLIC_BOUT_FIELDS } from "@/lib/publicBouts";
import ShowcaseCards from "@/components/showcases/ShowcaseCards";
import Funnel, { type Theme } from "@/components/funnel/Funnel";
import { VoteVisual } from "@/components/funnel/FunnelVisuals";

// Home: built on the same funnel layout as every product page. What's live comes right
// under the hero, then how it works, the products, and the door for organizers (/host).

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

const theme: Theme = {
  deep: "#0a0e1a",
  deep2: "#151b2e",
  accent: "#ff4d63",
  accentInk: "#ffffff",
  accentDark: "#c81f3c",
  gold: "#ffc531",
  goldGlow: "rgba(255,197,49,.5)",
  glow: "rgba(27,79,228,.55)",
  glow2: "rgba(229,38,59,.28)",
  soft: "#c9d0e0",
  paper: "#f4f6fb",
};

const PRODUCTS: { emoji: string; name: string; line: string; href: string }[] = [
  { emoji: "🥊", name: "Bouts", line: "Head to head. One vote each.", href: "/matchups" },
  { emoji: "🏆", name: "Competitions", line: "Run a bracket the crowd decides.", href: "/competitions/play" },
  { emoji: "🔮", name: "Predictions", line: "Call the winner and the score.", href: "/predictions/play" },
  { emoji: "🗳️", name: "Live Vote", line: "Elections, polls and live events.", href: "/host" },
  { emoji: "🎬", name: "Showcases", line: "Many groups, one video, one winner.", href: "/showcase/play" },
  { emoji: "🎙️", name: "Debates", line: "Pick a side and make your case.", href: "/debates/play" },
  { emoji: "💵", name: "Paid Bouts", line: "Entry-fee contests with prizes.", href: "/paid-bouts/play" },
  { emoji: "🏫", name: "Schools", line: "Votes for campuses and leagues.", href: "/schools" },
];

export default async function Home() {
  const { bouts, tallies, liveVotes, signedIn, myEvents } = await loadData();
  const firstBout = bouts[0];
  const liveCount = bouts.length + liveVotes.length;
  const ink = { fontFamily: "var(--cond), 'Arial Narrow', sans-serif", textTransform: "uppercase" as const, fontWeight: 900, color: "#0a0e1a" };

  const live = (
    <div>
      <section id="live" className="mb-10">
        <SectionHead title="Live matchups" href="/matchups" linkLabel="See all" />
        {bouts.length === 0 ? (
          <EmptyCard text="No matchups are live right now. Check back soon, or start your own." href="/create" cta="Create" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bouts.map((b) => (
              <Link key={b.id} href={`/bout/${b.id}`} className="bc-card flex min-w-0 flex-col gap-3 p-4 transition-transform hover:-translate-y-0.5" style={{ borderRadius: 22 }}>
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
                  <span className="text-[11px] font-black" style={{ color: "var(--text-faint)" }}>VS</span>
                  <span className="line-clamp-2 text-right text-sm font-bold">{b.competitor_b_name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: "var(--text-faint)" }}>
                    {(tallies.get(b.id) ?? 0).toLocaleString()} {tallies.get(b.id) === 1 ? "vote" : "votes"}
                  </span>
                  <span className="font-bold" style={{ color: "#c81f3c" }}>Vote →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <ShowcaseCards heading="Showcases — one video, pick your favorite" limit={3} />

      {liveVotes.length > 0 && (
        <section className="mb-10">
          <SectionHead title="Live events" href="/explore" linkLabel="See all" />
          <div className="grid gap-3 sm:grid-cols-2">
            {liveVotes.map((e) => (
              <Link key={e.id} href={`/vote/${e.id}`} className="bc-card flex min-w-0 items-center justify-between gap-3 p-4 transition-transform hover:-translate-y-0.5" style={{ borderRadius: 22 }}>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
                    {e.brand_name ?? e.category_name ?? "Live Vote"}
                  </span>
                  <span className="block truncate font-bold">{e.title}</span>
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                    {e.option_count} options · {e.vote_count.toLocaleString()} votes
                  </span>
                </span>
                <span className="flex-shrink-0 text-sm font-bold" style={{ color: "#c81f3c" }}>Vote →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-1 text-[2rem] leading-none sm:text-[2.6rem]" style={ink}>Pick your game</h2>
        <p className="mb-5 text-sm" style={{ color: "#4a5163" }}>Every way to vote, predict and compete on BoutCasts.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUCTS.map((p) => (
            <Link key={p.name} href={p.href} className="bc-card flex flex-col gap-1 p-4 transition-transform hover:-translate-y-0.5" style={{ borderRadius: 22 }}>
              <span className="text-2xl" aria-hidden>{p.emoji}</span>
              <span className="text-lg leading-tight" style={{ ...ink, fontSize: "1.25rem" }}>{p.name}</span>
              <span className="text-sm" style={{ color: "#4a5163" }}>{p.line}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );

  return (
    <Funnel
      theme={theme}
      kicker={liveCount > 0 ? `${liveCount} live now` : "Live voting"}
      live
      title={["Who won?", "[[You decide.]]"]}
      lede="Band battles, dance-offs, debates and halftime showdowns, decided by the crowd. Watch, vote and share your pick."
      primary={{ label: "Watch & vote", href: firstBout ? `/bout/${firstBout.id}` : "/discover" }}
      secondary={{ label: myEvents > 0 ? `Your events (${myEvents})` : "Host a vote", href: myEvents > 0 ? "/live-vote" : "/host" }}
      fine={signedIn ? "No account needed for your first vote." : "No account needed for your first vote. Got a code? Join a private event at boutcasts.com/join."}
      visual={<VoteVisual />}
      midSlot={live}
      ticker={["Band battles", "Dance-offs", "Debates", "Halftime shows", "Class elections", "Talent shows", "Step shows", "Brackets", "Predictions"]}
      stepsTitle="Vote in three taps"
      stepsLede="No sign-up wall between you and your pick."
      steps={[
        { title: "Watch", body: "Open a matchup or event and watch both sides." },
        { title: "Vote", body: "Cast one fair vote. Your first one needs no account." },
        { title: "Share", body: "Send your pick to friends so the crowd keeps growing." },
        { title: "See the result", body: "Winners advance automatically when voting closes." },
      ]}
      featuresTitle="One place for every vote"
      featuresLede="Fans get a simple ballot. Organizers get a link, a tally and fair rules."
      features={[
        { icon: "🥊", title: "Head-to-head bouts", body: "Two sides, one winner, live percentages as the crowd votes.", span: 3, hot: true },
        { icon: "🏆", title: "Brackets that run themselves", body: "Winners advance automatically when each round's voting closes.", span: 3 },
        { icon: "🗳️", title: "Live Vote events", body: "Elections, halftime polls and talent shows with a live tally for the big screen.", span: 2 },
        { icon: "🔮", title: "Predictions", body: "Call winners and scores with friends and climb a leaderboard.", span: 2 },
        { icon: "🔗", title: "Share cards", body: "Every link previews who is in it, what kind of event it is and when it starts and closes.", span: 2 },
      ]}
      usesTitle="Built for"
      uses={[
        { emoji: "🎺", title: "Bands and halftime shows", body: "Settle the battle with a real crowd vote." },
        { emoji: "🏫", title: "Schools", body: "Class elections and homecoming courts." },
        { emoji: "💃", title: "Dance and step shows", body: "Let the crowd pick the champion." },
        { emoji: "🎤", title: "Talent shows", body: "One link, one fair vote each." },
        { emoji: "🏟️", title: "Leagues and venues", body: "Fan polls and bracket challenges." },
        { emoji: "🎙️", title: "Creators", body: "Put the hot take to a vote." },
      ]}
      faq={[
        { q: "Do I need an account to vote?", a: "Your first vote needs no account. Create one to keep voting, earn points and see your history." },
        { q: "Is it free?", a: "Voting is free. Hosting a vote is free to start; see the Host page for what paid plans add." },
        { q: "How do you keep votes fair?", a: "One vote per person per matchup, with checks against repeat voting." },
        { q: "I have a code from my school or event.", a: "Use Join a private event at boutcasts.com/join and enter the code." },
        { q: "Can I run my own?", a: "Yes. Start a Live Vote free, run a competition, or ask about showcases, debates and Paid Bouts." },
      ]}
      closing={{
        headline: "Ready to pick a side?",
        body: "Jump into a live matchup, or start your own vote in minutes.",
        primary: { label: "Watch & vote", href: firstBout ? `/bout/${firstBout.id}` : "/discover" },
        secondary: { label: "Host a vote", href: "/host" },
      }}
      crossLinks={[
        { label: "Schools", href: "/schools" },
        { label: "Sponsors", href: "/sponsor/play" },
        { label: "How it works", href: "/how-it-works" },
        ...(signedIn ? [] : [{ label: "Log in", href: "/login" }]),
      ]}
    />
  );
}

function SectionHead({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-[1.6rem] leading-none sm:text-[2rem]" style={{ fontFamily: "var(--cond), 'Arial Narrow', sans-serif", textTransform: "uppercase", fontWeight: 900, color: "#0a0e1a" }}>
        {title}
      </h2>
      <Link href={href} className="text-sm font-semibold" style={{ color: "#c81f3c" }}>
        {linkLabel} →
      </Link>
    </div>
  );
}

function EmptyCard({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="bc-card flex flex-wrap items-center justify-between gap-3 p-5 text-sm" style={{ color: "var(--text-dim)", borderRadius: 22 }}>
      {text}
      <Link href={href} className="font-bold" style={{ color: "#c81f3c" }}>
        {cta} →
      </Link>
    </div>
  );
}
