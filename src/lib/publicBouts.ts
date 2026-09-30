// Which bouts are ready for the public lists (home, Matchups, category hubs,
// search). Bracket placeholders ("TBD" slots waiting on an earlier round) and
// bouts with no clips attached stay out of those lists — they still show on
// their own bracket page and to admins.
type BoutLike = {
  bout_mode?: "open" | "closed" | null;
  competitor_a_name?: string | null;
  competitor_b_name?: string | null;
  competitor_a_submission_id?: string | null;
  competitor_b_submission_id?: string | null;
};

export function isPlaceholderName(name: string | null | undefined) {
  return !name || !name.trim() || name.trim().toUpperCase() === "TBD";
}

export function isPublicBout(b: BoutLike) {
  // Open bouts wait for a challenger, so one clip is enough to list them.
  if (b.bout_mode === "open") return !!(b.competitor_a_submission_id || b.competitor_b_submission_id);
  return (
    !isPlaceholderName(b.competitor_a_name) &&
    !isPlaceholderName(b.competitor_b_name) &&
    !!b.competitor_a_submission_id &&
    !!b.competitor_b_submission_id
  );
}

export const PUBLIC_BOUT_FIELDS = "bout_mode, competitor_a_submission_id, competitor_b_submission_id";
