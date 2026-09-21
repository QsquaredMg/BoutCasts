export const CLOUT_TIERS = [
  { name: "Rookie", min: 0 },
  { name: "Contender", min: 50 },
  { name: "Rising Star", min: 150 },
  { name: "Headliner", min: 350 },
  { name: "Legend", min: 750 },
];

export function cloutTierFor(points: number) {
  let tier = CLOUT_TIERS[0];
  let next: (typeof CLOUT_TIERS)[number] | null = null;
  for (let i = 0; i < CLOUT_TIERS.length; i++) {
    if (points >= CLOUT_TIERS[i].min) {
      tier = CLOUT_TIERS[i];
      next = CLOUT_TIERS[i + 1] ?? null;
    }
  }
  const pct = next
    ? Math.min(100, Math.round(((points - tier.min) / (next.min - tier.min)) * 100))
    : 100;
  return { tier: tier.name, next, pct };
}
