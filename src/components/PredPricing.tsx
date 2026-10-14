import Link from "next/link";
import { BRACKET_PRICING, TOURNEY_TIERS, money } from "@/lib/predictions/pricing";

// The one price list for Bout Predictions. Players never pay; these are organizer prices.
export default function PredPricing() {
  const items = [
    {
      name: "Single game",
      price: "Free",
      note: "One every two weeks, open 24 hours.",
      href: "/predictions/new",
      cta: "Start a free game",
    },
    {
      name: "Private game",
      price: `${money(BRACKET_PRICING.privateGameCents)} per game`,
      note: "Invite-only with a join code. Your group only.",
      href: "/predictions/private/new",
      cta: "Make a private game",
    },
    {
      name: "Game slate",
      price: money(BRACKET_PRICING.weeklyCents),
      note: `Many games, one leaderboard. Open ${BRACKET_PRICING.weeklyDays} days, or ${money(BRACKET_PRICING.seasonCents)} for the whole season.`,
      href: "/predictions/bracket/new",
      cta: "Build a slate",
    },
    {
      name: "Tournament bracket",
      price: `from ${money(TOURNEY_TIERS[0].cents)}`,
      note: `March Madness style, up to 64 teams. Free to build. ${TOURNEY_TIERS.map((t) => `${money(t.cents)} for up to ${t.cap.toLocaleString()} entrants`).join(", ")}.`,
      href: "/predictions/tournament/new",
      cta: "Build a bracket",
    },
  ];
  return (
    <section className="mb-8" aria-labelledby="pred-pricing">
      <h2 id="pred-pricing" className="pt-h2 mb-1">Pricing</h2>
      <p className="mb-3 text-sm" style={{ color: "var(--text-dim)" }}><strong>Players always play free.</strong> These prices are for the organizer only, paid once.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.name} className="bc-card flex flex-col gap-1 p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>{it.name}</h3>
            <p className="text-2xl font-black" style={{ fontFamily: "var(--font-display)" }}>{it.price}</p>
            <p className="flex-1 text-xs" style={{ color: "var(--text-dim)" }}>{it.note}</p>
            <Link href={it.href} className="mt-2 text-sm font-bold underline">{it.cta}</Link>
          </div>
        ))}
      </div>
    </section>
  );
}
