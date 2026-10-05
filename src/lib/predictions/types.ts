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
  home_score: number | null;
  away_score: number | null;
  finalized_at: string | null;
};

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
  "id, slate_id, created_by, home_name, home_logo, away_name, away_logo, starts_at, allow_draw, status, home_score, away_score, finalized_at";

/** locked = started, closed or cancelled. */
export function isLocked(g: Pick<PredGame, "starts_at" | "status">, now = Date.now()) {
  return g.status !== "scheduled" || new Date(g.starts_at).getTime() <= now;
}
