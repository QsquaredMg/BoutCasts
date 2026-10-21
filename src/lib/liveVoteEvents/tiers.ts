// Pricing/duration/vote-cap config for Live Vote Events, per organizer tier.
// Kept in one place because both the checkout route and the webhook need to
// agree on price and duration, and the DB enforces the price/tier pairing
// via a CHECK constraint (live_vote_events_price_matches_tier) and the vote
// cap via a trigger (enforce_live_vote_cap) — this file must stay in sync
// with both.
export type LiveVoteTier = "free" | "small" | "medium" | "large";

export const LIVE_VOTE_TIERS: Record<
  LiveVoteTier,
  { label: string; priceCents: number; durationMs: number; voteCap: number }
> = {
  // Free: basic crowd "pick one" vote — no ranked choice, judges or custom
  // branding; one live at a time, 5 per 30 days (activate_free_live_vote_event).
  free: {
    label: "Free",
    priceCents: 0,
    durationMs: 12 * 60 * 60 * 1000,
    voteCap: 25,
  },
  small: {
    label: "Small",
    priceCents: 4900,
    durationMs: 24 * 60 * 60 * 1000,
    voteCap: 500,
  },
  medium: {
    label: "Medium",
    priceCents: 14900,
    durationMs: 3 * 24 * 60 * 60 * 1000,
    voteCap: 5000,
  },
  large: {
    label: "Large",
    priceCents: 39900,
    durationMs: 7 * 24 * 60 * 60 * 1000,
    voteCap: 50000,
  },
};

export function isLiveVoteTier(value: unknown): value is LiveVoteTier {
  return value === "free" || value === "small" || value === "medium" || value === "large";
}

// Pro add-on for a single event: demographic breakdowns, turnout over time,
// and CSV export. Organizer Pro includes this on every event.
export const PRO_ADDON_CENTS = 2900;

// Monthly Organizer Pro plan. Keep in sync with organizer_pro_status() and
// activate_live_vote_event_with_plan() in the database.
export const ORGANIZER_PRO = {
  priceCents: 9900,
  includedEventsPerPeriod: 3,
  includedTiers: ["small", "medium"] as LiveVoteTier[],
};

// Organizer Gold: Pro benefits plus the right to sell sponsor packages for
// your own events. Sponsors pay BoutCasts; BoutCasts keeps platformFeePct of
// each sponsorship and owes the organizer the rest after the event closes.
// Keep platformFeePct in sync with record_event_sponsorship() in the database.
export const ORGANIZER_GOLD = {
  priceCents: 19900, // placeholder: confirm before launch
  platformFeePct: 10,
};

export function tierPriceLabel(tier: LiveVoteTier): string {
  const cents = LIVE_VOTE_TIERS[tier].priceCents;
  return cents === 0 ? "Free" : `$${(cents / 100).toFixed(0)}`;
}

// Annual school / league license: shared staff seats, unlimited Small and
// Medium events, Pro + white-label on every event. Keep in sync with
// org_license_active() / organizer_pro_status() in the database.
export const ORG_LICENSE = {
  priceCents: 25000,
  seats: 10,
};

// Time add-on: an organizer can extend a live event by whole days. Keep the
// per-day price in sync with add_live_vote_days() in docs/sql/pricing_75_platinum_addon.sql.
export const TIME_ADDON = {
  centsPerDay: 2500,
  maxDays: 14,
};

// School election kiosk mode: several offices on one ballot, a roster of students with codes, and
// up to maxKiosks iPads at a booth. The first kiosk and the first day are included in the base
// price (the size tier price); each extra kiosk and each extra day is charged on top.
// Keep in sync with docs/sql/kiosk_mode.sql (kiosks 1-3, days 1-3).
export const SCHOOL_ELECTION = {
  tiers: ["free", "small", "medium", "large"] as LiveVoteTier[],
  maxKiosks: 3,
  maxDays: 3,
  extraKioskCents: 2500,
  extraDayCents: 15000,
};

export function schoolElectionPriceCents(tier: LiveVoteTier, kiosks: number, days: number): number {
  return (
    LIVE_VOTE_TIERS[tier].priceCents +
    Math.max(0, kiosks - 1) * SCHOOL_ELECTION.extraKioskCents +
    Math.max(0, days - 1) * SCHOOL_ELECTION.extraDayCents
  );
}

// Super Votes: organizer unlocks per event; fans buy packs to boost a
// contestant. Organizer earns organizerShare (90%) of final collections, less
// any applicable fees.
export const SUPER_VOTES = {
  unlockCents: 4900,
  organizerShare: 0.9,
  // Platinum Supporter: the top tier. The organizer sets a fixed price, or
  // leaves it open so a fan can give any amount of platinumMinCents or more.
  platinumMinCents: 2000,
  // Platinum buys Super Votes at the best pack rate (150 for $9.99, about 15 per dollar).
  platinumVotesPerDollar: 15,
  packs: [
    { key: "s10", quantity: 10, cents: 99 },
    { key: "s50", quantity: 50, cents: 399 },
    { key: "s150", quantity: 150, cents: 999 },
  ] as const,
};
export type SuperVotePackKey = (typeof SUPER_VOTES.packs)[number]["key"];
