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
    durationMs: 24 * 60 * 60 * 1000,
    voteCap: 50,
  },
  small: {
    label: "Small",
    priceCents: 4900,
    durationMs: 4 * 60 * 60 * 1000,
    voteCap: 500,
  },
  medium: {
    label: "Medium",
    priceCents: 14900,
    durationMs: 24 * 60 * 60 * 1000,
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

export function tierPriceLabel(tier: LiveVoteTier): string {
  const cents = LIVE_VOTE_TIERS[tier].priceCents;
  return cents === 0 ? "Free" : `$${(cents / 100).toFixed(0)}`;
}

// Annual school / league license: shared staff seats, unlimited Small and
// Medium events, Pro + white-label on every event. Keep in sync with
// org_license_active() / organizer_pro_status() in the database.
export const ORG_LICENSE = {
  priceCents: 149900,
  seats: 10,
};
