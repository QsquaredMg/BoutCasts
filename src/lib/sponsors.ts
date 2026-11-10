// Sponsor library: one sponsor, many placements (trivia packs, live votes, brackets, single bouts).
export type SponsorKind = "trivia" | "vote" | "bracket" | "bout";
export type SponsorLevel = "title" | "gold" | "supporter";

export const KIND_NAME: Record<SponsorKind, string> = { trivia: "Trivia pack", vote: "Live vote", bracket: "Prediction bracket", bout: "Bout" };
export const LEVEL_LABEL: Record<SponsorLevel, string> = { title: "Title sponsor (Presented by)", gold: "Gold", supporter: "Supporter" };

export type LibrarySponsor = {
  id: string;
  name: string;
  logo_url: string | null;
  link_url: string | null;
  commercial_url: string | null;
  commercial_kind: "video" | "image" | null;
};

/** One sponsor placed on one event, as the event's organizer sees it (with counts). */
export type TargetSponsor = LibrarySponsor & {
  placement_id: string;
  sponsor_id: string;
  level: SponsorLevel;
  amount_cents: number | null;
  with_commercial: boolean;
  can_edit: boolean;
  views: number;
  clicks: number;
  commercials: number;
};

export const dollars = (c: number) => `$${(c / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
export const toCents = (v: string): number | null => {
  const n = Number(v.replace(/[$,\s]/g, ""));
  return v.trim() === "" || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 100);
};
export const normLink = (v: string): string | null => {
  const t = v.trim();
  return !t ? null : /^https?:\/\//i.test(t) ? t : `https://${t}`;
};
/** Friendly text for a database error from the sponsor tables. */
export const sponsorError = (m: string) =>
  m.includes("check constraint") ? "Check the website link, logo and commercial link (logos and commercials must be https), then try again." : m;
