import Link from "next/link";
import { CLOUT_TIERS } from "@/lib/clout";

const STEPS = [
  {
    icon: "🎬",
    title: "Submit a clip",
    body:
      "Upload a video or audio clip of your act — a verse, a dance, a debate round, a highlight — and pick the category it belongs in. Every entry goes to moderation before it can compete.",
  },
  {
    icon: "🥊",
    title: "Get matched",
    body:
      "Approved entries get matched head-to-head against another competitor in the same category, either as a standalone bout or as a slot in a tournament bracket.",
  },
  {
    icon: "🗳️",
    title: "The crowd votes",
    body:
      "Anyone can watch a bout and cast one vote for a winner. Voting is locked to one vote per account, and results update live while the bout is open.",
  },
  {
    icon: "🏆",
    title: "Winners advance",
    body:
      "When voting closes, the side with more votes wins. In a bracket, winners advance automatically to the next round until a champion is crowned.",
  },
  {
    icon: "⭐",
    title: "Earn Clout and badges",
    body:
      "Winning bouts, climbing brackets, and staying active earns points toward your Clout tier and unlocks badges shown on your profile.",
  },
  {
    icon: "💰",
    title: "BoutBucks wallet",
    body:
      "Some bouts and challenges pay out BoutBucks. Use your balance to enter paid challenges or chip in on crowdfunded prize pools.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1
        className="mb-1 text-2xl font-bold"
        style={{ fontFamily: "var(--font-display)" }}
      >
        How BoutCasts works
      </h1>
      <p className="mb-8 text-sm" style={{ color: "var(--text-faint)" }}>
        Any talent, any category, one format: head-to-head, crowd-judged battles.
      </p>

      <div className="mb-10 grid gap-4 sm:grid-cols-2">
        {STEPS.map((s) => (
          <div
            key={s.title}
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="mb-2 text-2xl">{s.icon}</div>
            <div className="mb-1 text-base font-bold" style={{ fontFamily: "var(--font-display)" }}>
              {s.title}
            </div>
            <p className="text-sm" style={{ color: "var(--text-faint)" }}>
              {s.body}
            </p>
          </div>
        ))}
      </div>

      <h2
        className="mb-3 text-lg font-bold"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Clout tiers
      </h2>
      <p className="mb-4 text-sm" style={{ color: "var(--text-faint)" }}>
        Every point you earn counts toward your Clout tier — shown on your profile and the leaderboard.
      </p>
      <div className="bc-card mb-10 flex flex-col overflow-hidden">
        {CLOUT_TIERS.map((t, i) => (
          <div
            key={t.name}
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
          >
            <span className="text-sm font-bold">{t.name}</span>
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>
              {t.min}+ pts
            </span>
          </div>
        ))}
      </div>

      <h2
        className="mb-3 text-lg font-bold"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Fair play
      </h2>
      <p className="mb-2 text-sm" style={{ color: "var(--text-faint)" }}>
        Voting is verified — one vote per account, every time. If something looks off, use the{" "}
        <span className="font-semibold" style={{ color: "var(--text-dim)" }}>
          Report
        </span>{" "}
        button on any bout. If your submission gets rejected, you can file a one-time appeal for a
        moderator to take another look.
      </p>

      <Link
        href="/submit"
        className="bc-btn-solid mt-6 inline-block rounded-full px-5 py-2.5 text-sm"
      >
        Submit your first entry
      </Link>
    </div>
  );
}
