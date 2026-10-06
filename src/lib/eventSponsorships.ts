import { ORGANIZER_GOLD } from "@/lib/liveVoteEvents/tiers";

export type SponsorLevel = "title" | "gold" | "supporter";
export const SPONSOR_LEVEL_LABEL: Record<SponsorLevel, string> = { title: "Title sponsor", gold: "Gold", supporter: "Supporter" };

export const PACKAGE_MIN_CENTS = 2500;
export const PACKAGE_MAX_CENTS = 1000000;

export function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

// Same rounding as record_event_sponsorship() in the database.
export function splitSponsorship(grossCents: number) {
  const fee = Math.floor((grossCents * ORGANIZER_GOLD.platformFeePct + 50) / 100);
  return { fee, organizer: grossCents - fee };
}
