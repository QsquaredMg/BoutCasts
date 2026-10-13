export type SocialKind = "bout" | "bracket" | "livevote" | "predictions" | "trivia" | "bout_launch" | "paidbout_launch";

export type TopRow = { rank: number; name: string; score: string };

export type SocialDraft = {
  kind: SocialKind;
  source_id: string;
  title: string;
  winner: string | null;
  top10: TopRow[];
  /** Short extra line, e.g. "62% to 38%" or "128 votes". */
  detail: string | null;
  /** Where people can see the full result. */
  path: string;
  /** Text scanned for school names to tag (titles, competitor names, descriptions). */
  mentionText?: string;
  /** Ready-made captions (launch posts); otherwise built from the result. */
  captions?: { facebook: string; instagram: string };
};

export const SITE = "https://www.boutcasts.com";
