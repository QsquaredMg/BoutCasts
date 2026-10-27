import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Play",
  description: "Call the winner with Bout Predictions or join a live trivia night on BoutCasts.",
};

const GAMES = [
  { href: "/predictions/play", icon: "🎯", title: "Bout Predictions", body: "Pick the winner and the score of real games with friends. Free to play, with leaderboards and tournament brackets.", cta: "Start predicting" },
  { href: "/trivia/play", icon: "❓", title: "Live Trivia", body: "Join a trivia night with a code from your host and answer on your phone against the room.", cta: "Join a game" },
  { href: "/leaderboard", icon: "🏆", title: "Leaderboard", body: "See who is winning across BoutCasts.", cta: "View rankings" },
];

export default function PlayPage() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-8">
      <h1 className="mb-1 text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Play</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-dim)" }}>Games you can join in a minute. Free.</p>
      <div className="flex flex-col gap-3">
        {GAMES.map((g) => (
          <Link key={g.href} href={g.href} className="bc-card flex items-start gap-4 p-5 transition-colors hover:bg-[var(--surface-2)]">
            <span className="text-3xl" aria-hidden>{g.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{g.title}</span>
              <span className="mt-0.5 block text-sm" style={{ color: "var(--text-dim)" }}>{g.body}</span>
            </span>
            <span className="self-center text-sm font-bold" style={{ color: "var(--red)" }}>{g.cta} →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
