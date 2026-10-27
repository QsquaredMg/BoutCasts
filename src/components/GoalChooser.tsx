import Link from "next/link";

// "What do you want to do?" One list of goals that sends people to the right tool, so nobody has to
// learn the difference between a Live Vote, a Competition and a Showcase before they start.
export type Goal = { href: string; icon: string; title: string; body: string; tag?: string };

export const HOST_GOALS: Goal[] = [
  { href: "/school-election/new", icon: "🏫", title: "Run a school election", body: "Student council, class officers, homecoming court. Voting kiosks, teacher PIN, secret ballots, certified results.", tag: "Schools" },
  { href: "/live-vote/new", icon: "🗳️", title: "Settle a vote or poll", body: "Halftime votes, talent nights, fan choice or any question. One link, one vote each, live results.", tag: "Free to start" },
  { href: "/predictions/tournament/new", icon: "🏆", title: "Build a bracket", body: "March Madness, playoffs, talent shows or mascot battles. Choose whether final scores or crowd votes move the winners forward." },
  { href: "/predictions/start", icon: "🎯", title: "Start a prediction game", body: "Fans pick the winners of real games: a single game, a pick'em, a prediction bracket or a private pool." },
  { href: "/trivia/packs", icon: "❓", title: "Host a trivia night", body: "Pick a question pack and run it live on the big screen with players on their phones." },
];

export const COMPETE_GOALS: Goal[] = [
  { href: "/submit", icon: "🥊", title: "Enter a head-to-head", body: "Submit your clip (band, dance, rap, singing and more). We match you with an opponent and the crowd decides." },
  { href: "/debates", icon: "🎙️", title: "Join a debate", body: "Pick a side on an open topic, record your argument and go head to head." },
];

export default function GoalChooser({ goals, heading, compact = false }: { goals: Goal[]; heading?: string; compact?: boolean }) {
  return (
    <div>
      {heading && (
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
          {heading}
        </h2>
      )}
      <div className={compact ? "grid gap-3 sm:grid-cols-2" : "flex flex-col gap-3"}>
        {goals.map((o) => (
          <Link key={o.href} href={o.href} className="bc-card flex items-start gap-4 p-5 transition-colors hover:bg-[var(--surface-2)]">
            <span className="text-3xl" aria-hidden>{o.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{o.title}</span>
                {o.tag && (
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "var(--red-soft)", color: "var(--red)" }}>{o.tag}</span>
                )}
              </span>
              <span className="mt-0.5 block text-sm" style={{ color: "var(--text-dim)" }}>{o.body}</span>
            </span>
            <span className="self-center text-lg font-bold" style={{ color: "var(--red)" }} aria-hidden>→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// The four ways to run predictions, all in one place under Predictions.
export const PREDICTION_GOALS: Goal[] = [
  { href: "/predictions/new", icon: "🎯", title: "Single game", body: "One matchup. Players pick the winner and the final score before it starts.", tag: "Free" },
  { href: "/predictions/bracket/new", icon: "📋", title: "Pick'em", body: "A list of games on one leaderboard, for a week or a whole season. Players pick every winner and score." },
  { href: "/predictions/tournament/new", icon: "🏆", title: "Bracket", body: "An elimination bracket players fill out before round one. You choose what advances it: final scores you enter, or crowd votes.", tag: "Scores or votes" },
  { href: "/predictions/private/new", icon: "🔒", title: "Private pool", body: "Invite-only, for your friends, family or office. Players join with a code and always play free." },
];
