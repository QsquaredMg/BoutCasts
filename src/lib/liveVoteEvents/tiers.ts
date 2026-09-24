// Pricing/duration/vote-cap config for Live Vote Events, per organizer tier.
// Kept in one place because both the checkout route and the webhook need to
// agree on price and duration, and the DB enforces the price/tier pairing
// via a CHECK constraint (live_vote_events_price_matches_tier) and the vote
// cap via a trigger (enforce_live_vote_cap) — this file must stay in sync
// with both.
export type LiveVoteTier = "small" | "medium" | "large";

export const LIVE_VOTE_TIERS: Record<
  LiveVoteTier,
  { label: string; priceCents: number; durationMs: number; voteCap: number }
> = {
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
  return value === "small" || value === "medium" || value === "large";
}
