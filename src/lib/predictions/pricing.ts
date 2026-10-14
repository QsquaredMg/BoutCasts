// Bout Predictions bracket pricing. Keep in sync with the copy on /predictions.
export const BRACKET_PRICING = {
  weeklyCents: 1000, // 8 days open
  seasonCents: 2500, // open all season, closes manually or at a scheduled time
  upgradeCents: 1500, // weekly -> season
  weeklyDays: 8,
  privateGameCents: 500, // closed invite-only game: creator pays per game, invitees play free
} as const;

export type BracketTier = "weekly" | "season" | "private";

export const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

export function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  return fromEnd === 0 ? "Final" : fromEnd === 1 ? "Semifinals" : fromEnd === 2 ? "Quarterfinals" : `Round ${round}`;
}

// Tournament brackets (March Madness style pools): the organizer pays once, by how many people can enter. Players always play free.
export const TOURNEY_TIERS = [
  { cap: 16, cents: 1000, label: "Starter" },
  { cap: 64, cents: 1500, label: "Standard" },
  { cap: 250, cents: 2500, label: "Pro" },
  { cap: 1000, cents: 5500, label: "Event" },
] as const;

export function tourneyCents(cap: number | null | undefined): number | null {
  return TOURNEY_TIERS.find((t) => t.cap === cap)?.cents ?? null;
}

/** Points for a correct pick: 1 in round 1, doubling each round (2^(round-1)). Keep in sync with finalize_pred_game(). */
export const roundPoints = (round: number) => 2 ** (round - 1);
