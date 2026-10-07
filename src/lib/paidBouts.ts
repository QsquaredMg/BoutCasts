// Paid Bouts: shared money rules. The database enforces the same arithmetic
// (see docs/sql/paid_bouts.sql); keep both in sync.
//
// Published terms, in payout order:
//   1. BoutCasts keeps PLATFORM_FEE_PCT percent of all entry fees.
//   2. Prizes are fixed amounts, set up front, and are paid next.
//   3. The organizer receives the remainder, and only after 1 and 2 are paid.

export const PLATFORM_FEE_PCT = 20;
export const MIN_ENTRY_FEE_CENTS = 500;
export const MAX_ENTRY_FEE_CENTS = 50000;
export const MAX_PRIZES = 10;

export type PaidBoutStatus = "draft" | "pending_review" | "open" | "closed" | "settling" | "settled" | "cancelled";

export const STATUS_LABEL: Record<PaidBoutStatus, string> = {
  draft: "Draft",
  pending_review: "Waiting for review",
  open: "Open for entries",
  closed: "Entries closed",
  settling: "Paying out",
  settled: "Paid out",
  cancelled: "Cancelled and refunded",
};

export const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** BoutCasts' share of gross entry fees, rounded to the nearest cent. */
export function platformFee(grossCents: number, pct = PLATFORM_FEE_PCT): number {
  return Math.floor((grossCents * pct + 50) / 100);
}

/** Entry-fee income left after the platform fee. */
export function netAfterFee(grossCents: number, pct = PLATFORM_FEE_PCT): number {
  return grossCents - platformFee(grossCents, pct);
}

/** The fewest entries (never fewer than 2) at which the prizes are fully covered. */
export function minEntriesForPrizes(prizeTotalCents: number, feeCents: number, pct = PLATFORM_FEE_PCT): number {
  let n = 2;
  while (netAfterFee(n * feeCents, pct) < prizeTotalCents) n++;
  return n;
}

export type Split = { gross: number; platformFee: number; prizes: number; organizer: number };

/** How the entry fees split once the bout is over. */
export function splitEntryFees(grossCents: number, prizeTotalCents: number, pct = PLATFORM_FEE_PCT): Split {
  const fee = platformFee(grossCents, pct);
  return { gross: grossCents, platformFee: fee, prizes: prizeTotalCents, organizer: grossCents - fee - prizeTotalCents };
}

export type PrizeInput = { place: number; amountCents: number };

export type CreateInput = {
  title: string;
  description?: string;
  rules: string;
  judging: string;
  entryFeeCents: number;
  minEntries: number;
  maxEntries?: number | null;
  entryDeadline: string;
  inviteOnly: boolean;
  prizes: PrizeInput[];
};

/** Returns an error message, or null when the input is valid. */
export function validateCreate(i: CreateInput, now = Date.now()): string | null {
  if (i.title.trim().length < 3 || i.title.trim().length > 120) return "Give the bout a title of 3 to 120 characters.";
  if (i.rules.trim().length < 40) return "Write the rules in at least 40 characters. Entrants see them before they pay.";
  if (i.judging.trim().length < 20) return "Say how the winners will be chosen (at least 20 characters).";
  if (!Number.isInteger(i.entryFeeCents) || i.entryFeeCents < MIN_ENTRY_FEE_CENTS || i.entryFeeCents > MAX_ENTRY_FEE_CENTS)
    return `The entry fee must be between ${money(MIN_ENTRY_FEE_CENTS)} and ${money(MAX_ENTRY_FEE_CENTS)}.`;
  if (!Number.isInteger(i.minEntries) || i.minEntries < 2) return "The minimum number of entries is at least 2.";
  if (i.maxEntries != null && (!Number.isInteger(i.maxEntries) || i.maxEntries < i.minEntries))
    return "The maximum number of entries can't be below the minimum.";
  const deadline = Date.parse(i.entryDeadline);
  if (!Number.isFinite(deadline) || deadline < now + 60 * 60 * 1000) return "Entries must stay open for at least an hour.";
  if (i.prizes.length < 1 || i.prizes.length > MAX_PRIZES) return `Add between 1 and ${MAX_PRIZES} prizes.`;
  const places = new Set<number>();
  for (const p of i.prizes) {
    if (!Number.isInteger(p.place) || p.place < 1 || p.place > MAX_PRIZES || places.has(p.place)) return "Each prize needs its own place (1st, 2nd, 3rd...).";
    if (!Number.isInteger(p.amountCents) || p.amountCents <= 0) return "Each prize needs an amount above $0.";
    places.add(p.place);
  }
  for (let place = 1; place <= i.prizes.length; place++) if (!places.has(place)) return "Prizes must run in order: 1st, then 2nd, and so on.";
  const total = i.prizes.reduce((s, p) => s + p.amountCents, 0);
  const covered = netAfterFee(i.minEntries * i.entryFeeCents);
  if (total > covered)
    return `Prizes total ${money(total)}, but at ${i.minEntries} entries only ${money(covered)} is left after BoutCasts' ${PLATFORM_FEE_PCT}% fee. Lower the prizes or raise the minimum entries to ${minEntriesForPrizes(total, i.entryFeeCents)}.`;
  return null;
}
