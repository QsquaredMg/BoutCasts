export type ShowcaseKind = "bout" | "debate";

export type Showcase = {
  id: string;
  kind: ShowcaseKind;
  title: string;
  description: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  source_type: "upload" | "record" | "link";
  source_url: string;
  scoring_mode: "crowd" | "judges" | "both";
  crowd_weight: number;
  hide_tally: boolean;
  status: "draft" | "live" | "closed";
  closes_at: string | null;
  winner_choice_id: string | null;
  created_at: string;
};

export type ShowcaseChoice = {
  id: string;
  showcase_id: string;
  name: string;
  team_name: string | null;
  image_url: string | null;
  start_seconds: number | null;
  sort_order: number;
  crowd_votes: number | null;
  judge_score: number | null;
};

export const CRITERIA: Record<ShowcaseKind, [string, string, string, string]> = {
  bout: ["Skill", "Creativity", "Performance", "Crowd appeal"],
  debate: ["Argument", "Evidence", "Rebuttal", "Delivery"],
};

export const KIND_LABEL: Record<ShowcaseKind, { noun: string; question: string; choice: string }> = {
  bout: { noun: "Showcase", question: "Who won?", choice: "group" },
  debate: { noun: "Panel debate", question: "Who won the debate?", choice: "debater" },
};

export function formatClock(seconds: number | null | undefined) {
  if (seconds == null) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

// "4:15", "1:02:30" or "255" -> seconds. Empty -> null. Invalid -> NaN.
export function parseClock(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  const parts = t.split(":").map((x) => x.trim());
  if (parts.some((x) => !/^\d+$/.test(x)) || parts.length > 3) return NaN;
  return parts.reduce((acc, x) => acc * 60 + Number(x), 0);
}
