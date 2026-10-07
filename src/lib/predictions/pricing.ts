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
