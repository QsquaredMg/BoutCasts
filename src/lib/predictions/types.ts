export type PredGame = {
  id: string;
  slate_id: string | null;
  created_by: string;
  home_name: string;
  home_logo: string | null;
  away_name: string;
  away_logo: string | null;
  starts_at: string;
  allow_draw: boolean;
  status: "scheduled" | "final" | "cancelled";
  scoring_version: number;
  crowd_state: "ready" | "too_few" | null;
  home_score: number | null;
  away_score: number | null;
  finalized_at: string | null;
  round: number | null;
  slot: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
  winner_team_id: string | null;
  feeds_game_id: string | null;
  feeds_side: "home" | "away" | null;
  is_private: boolean;
};

export type PredSlate = {
  id: string;
  title: string;
  created_by: string;
  kind: "slate" | "elimination";
  tier: "weekly" | "season" | "private";
  status: "pending" | "open" | "closed";
  closes_at: string | null;
  locks_at: string | null;
  bracket_size: number | null;
  brand_name: string | null;
  brand_logo_url: string | null;
  brand_color: string | null;
  white_label: boolean;
  visibility: "public" | "private";
  invite_code: string | null;
};

export type BracketTeam = { id: string; seed: number; name: string; logo: string | null };

export const SLATE_FIELDS = "id, title, created_by, kind, tier, status, closes_at, locks_at, bracket_size, brand_name, brand_logo_url, brand_color, white_label, visibility, invite_code";

export type PredPrediction = {
  id: string;
  game_id: string;
  user_id: string;
  pick: "home" | "away" | "draw";
  pred_home: number;
  pred_away: number;
  pts_entry: number | null;
  pts_winner: number | null;
  pts_exact: number | null;
  pts_close: number | null;
  pts_total: number | null;
  graded_at: string | null;
};

export type LeaderRow = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  points: number;
  games: number;
  winners: number;
  perfect: number;
};

export const GAME_FIELDS =
  "id, slate_id, created_by, home_name, home_logo, away_name, away_logo, starts_at, allow_draw, status, scoring_version, crowd_state, home_score, away_score, finalized_at, round, slot, home_team_id, away_team_id, winner_team_id, feeds_game_id, feeds_side, is_private";

/** locked = started, closed or cancelled. */
export function isLocked(g: Pick<PredGame, "starts_at" | "status">, now = Date.now()) {
  return g.status !== "scheduled" || new Date(g.starts_at).getTime() <= now;
}

/** True when the timestamp has already passed (server-side checks). */
export function hasPassed(iso: string, now = Date.now()) {
  return new Date(iso).getTime() <= now;
}
