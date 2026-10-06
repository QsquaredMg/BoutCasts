// Feature switches. Flip a value and redeploy to bring a feature back.

/**
 * BoutBucks (wallet balance, referral payouts, crowdfunded prize pools).
 * Off while points/badges/streaks are the single reward system and until
 * the prize-pool question has a legal review.
 */
export const BOUTBUCKS_ENABLED = false;

/**
 * Paid Bouts: competitions with an entry fee, where BoutCasts keeps 20% of
 * entry fees. While this is false only admins can create paid bouts (they are
 * opened by hand), organizers see the "contact us" message instead of the
 * create form, and everyone can still view and enter bouts that are open.
 * Flip to true only after the contest / sweepstakes rules for your target
 * states have a legal review (see the Paid Bouts notes in docs/sql/paid_bouts.sql).
 */
export const PAID_BOUTS_ENABLED = false;
