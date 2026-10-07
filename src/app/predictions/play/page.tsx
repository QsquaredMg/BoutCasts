import type { Metadata } from "next";
import Link from "next/link";
import { SCORING } from "@/lib/predictions/scoring";
import { BRACKET_PRICING, money } from "@/lib/predictions/pricing";

export const metadata: Metadata = {
  title: "Run your own prediction game",
  description:
    "Turn any game into a contest. Friends, classes, teams and crowds pick the winner and the final score, earn points, and climb a live leaderboard. Players always play free.",
  alternates: { canonical: "/predictions/play" },
};

const STEPS = [
  { n: "1", t: "Set up a game", d: "Pick two teams and a start time. Logos fill in for pro and college teams, or add your own." },
  { n: "2", t: "Share one link", d: "Text it, post it, or hand out a join code. Players only need an account, never a payment." },
  { n: "3", t: "Everyone calls it", d: "Each player picks the winner and the final score before the game starts." },
  { n: "4", t: "Points and bragging rights", d: "When the game ends, picks are graded automatically and the leaderboard updates." },
];

const FEATURES = [
  { i: "🎯", t: "Winner plus score", d: "Calling the winner is only the start. Players guess the exact score for bonus points, so every game stays interesting to the final whistle." },
  { i: "🏆", t: "Weekly and season leaderboards", d: "Points roll up automatically. Players chase the weekly crown and the season title." },
  { i: "🏟️", t: "Brackets and slates", d: "Run a whole tournament or a full weekend of games in one place, with one leaderboard across all of it." },
  { i: "🔒", t: "Private, invite-only games", d: "Keep it to your group. Share a code and only the people you invite can play." },
  { i: "📊", t: "Crowd picks and a shareable graphic", d: "Once enough people have picked, see how the crowd is leaning and share a graphic of it." },
  { i: "⏱️", t: "Fair by design", d: "Picks stay open until 15 minutes after the start time, then lock for everyone. No late changes once the result is clear." },
];

const USES = [
  { i: "🎓", t: "Classrooms and school spirit", d: "Teachers, coaches and student groups can run friendly rivalry games around the home team. It is a natural way to practice reading stats and making a call." },
  { i: "👨‍👩‍👧‍👦", t: "Family and friend groups", d: "Settle who really knows the game. A private game with a join code keeps the bragging rights in the group chat." },
  { i: "🍔", t: "Bars, restaurants and watch parties", d: "Give the room a reason to stay for the whole game. Put a link or QR code on the table and post the leaderboard." },
  { i: "🏫", t: "Booster clubs and school events", d: "Grow engagement before game night and give supporters something to talk about all week." },
  { i: "🎙️", t: "Creators and communities", d: "Add a prediction game to your stream, show or newsletter and turn viewers into a competing community." },
  { i: "🤝", t: "Sponsors and local business", d: "A game that fans return to every week is a place for a local business to be seen. Ask about sponsoring a game or a season." },
];

const FAQ = [
  { q: "Do players have to pay?", a: "No. Players always play free. Organizers get one free single game a day." },
  { q: "How do I keep a game private?", a: `A private game is invite-only and costs ${money(BRACKET_PRICING.privateGameCents)} per game. Invitees join with a code and play free.` },
  { q: "What about brackets?", a: `A bracket with many games is ${money(BRACKET_PRICING.weeklyCents)} and stays open ${BRACKET_PRICING.weeklyDays} days, or ${money(BRACKET_PRICING.seasonCents)} to stay open all season.` },
  { q: "When do picks lock?", a: "15 minutes after the game's start time." },
  { q: "Is this gambling?", a: "No. There is no money in play for players. It is points and bragging rights only." },
];

const card = { background: "var(--surface)", border: "1px solid var(--border)" } as const;

export default function PredictionsFunnelPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-8">
      {/* Hero */}
      <section className="mb-12 text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--blue)" }}>Bout Predictions</p>
        <h1 className="mb-3 text-4xl font-bold leading-tight sm:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
          Make every game a contest.
        </h1>
        <p className="mx-auto mb-6 max-w-xl text-base" style={{ color: "var(--text-dim)" }}>
          Share one link and your friends, class, team or crowd pick the winner and the final score, earn points, and climb a live leaderboard. Players always play free.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/predictions/new" className="bc-btn-solid rounded-full px-6 py-3 text-sm font-bold">Start a free game</Link>
          <Link href="/predictions" className="rounded-full border px-6 py-3 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>Browse open games</Link>
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--text-faint)" }}>One free game a day. No card needed.</p>
      </section>

      {/* How it works */}
      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-xl p-4" style={card}>
              <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold" style={{ background: "var(--blue)", color: "#fff" }}>{s.n}</span>
              <h3 className="mb-1 text-base font-bold">{s.t}</h3>
              <p className="text-sm" style={{ color: "var(--text-dim)" }}>{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Scoring */}
      <section className="mb-12 rounded-2xl p-6" style={card}>
        <h2 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Simple scoring, big swings</h2>
        <p className="mb-4 text-sm" style={{ color: "var(--text-dim)" }}>Nail the winner, then chase the bonus for the score. A perfect call is worth {SCORING.perfect} points.</p>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {[
            ["Correct winner", `+${SCORING.winner}`],
            ["Both scores exact", `+${SCORING.bothExact}`],
            ["One score exact", `+${SCORING.oneExact}`],
            ["Off by 1 or 2 points in total", `+${SCORING.closeNear}`],
            ["Off by 3 to 5 points in total", `+${SCORING.closeFar}`],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "var(--surface-2)" }}>
              <dt>{k}</dt>
              <dd className="font-bold" style={{ color: "var(--gold)" }}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Features */}
      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>What you get</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.t} className="rounded-xl p-4" style={card}>
              <div className="mb-1 text-2xl" aria-hidden>{f.i}</div>
              <h3 className="mb-1 text-base font-bold">{f.t}</h3>
              <p className="text-sm" style={{ color: "var(--text-dim)" }}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Uses */}
      <section className="mb-12">
        <h2 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Who runs a game</h2>
        <p className="mb-4 text-sm" style={{ color: "var(--text-dim)" }}>If people care about the game, they will care about the call.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {USES.map((u) => (
            <div key={u.t} className="rounded-xl p-4" style={card}>
              <div className="mb-1 text-2xl" aria-hidden>{u.i}</div>
              <h3 className="mb-1 text-base font-bold">{u.t}</h3>
              <p className="text-sm" style={{ color: "var(--text-dim)" }}>{u.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Plans */}
      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Pick your size</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { t: "Single game", p: "Free", d: "One a day, open 24 hours. Perfect for trying it out.", href: "/predictions/new", cta: "Start free" },
            { t: "Private game", p: money(BRACKET_PRICING.privateGameCents), d: "Invite-only with a join code. Invitees play free.", href: "/predictions/private/new", cta: "Create private" },
            { t: "Bracket", p: `${money(BRACKET_PRICING.weeklyCents)}+`, d: `Many games, one leaderboard. ${BRACKET_PRICING.weeklyDays} days, or ${money(BRACKET_PRICING.seasonCents)} for the season.`, href: "/predictions/bracket/new", cta: "Build a bracket" },
          ].map((x) => (
            <div key={x.t} className="flex flex-col rounded-xl p-4" style={card}>
              <h3 className="text-base font-bold">{x.t}</h3>
              <p className="my-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--gold)" }}>{x.p}</p>
              <p className="mb-4 flex-1 text-sm" style={{ color: "var(--text-dim)" }}>{x.d}</p>
              <Link href={x.href} className="rounded-full border px-4 py-2 text-center text-sm font-semibold" style={{ borderColor: "var(--border)" }}>{x.cta}</Link>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--text-faint)" }}>Players never pay. These prices are for the organizer only.</p>
      </section>

      {/* FAQ */}
      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Questions</h2>
        <div className="grid gap-2">
          {FAQ.map((f) => (
            <details key={f.q} className="rounded-xl p-4" style={card}>
              <summary className="cursor-pointer text-sm font-bold">{f.q}</summary>
              <p className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="rounded-2xl p-8 text-center" style={card}>
        <h2 className="mb-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Ready to call it?</h2>
        <p className="mx-auto mb-5 max-w-md text-sm" style={{ color: "var(--text-dim)" }}>Set up your first game in about a minute and send the link to your group.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/predictions/new" className="bc-btn-solid rounded-full px-6 py-3 text-sm font-bold">Start a free game</Link>
          <Link href="/predictions/join" className="rounded-full border px-6 py-3 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>I have a code</Link>
        </div>
        <p className="mt-4 text-xs" style={{ color: "var(--text-faint)" }}>
          Want your brand on a game or season? <Link href="/sponsor" className="underline">Sponsor a game</Link>.
        </p>
      </section>
    </div>
  );
}
