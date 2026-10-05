// Crowd summary of everyone's picks for one game (from the SQL function pred_crowd_stats).

export type CrowdStats = {
  locked: boolean;
  n?: number;
  home_n?: number;
  away_n?: number;
  draw_n?: number;
  avg_home?: number;
  avg_away?: number;
  avg_margin?: number;
  top_home?: number;
  top_away?: number;
  top_count?: number;
  state?: "ready" | "too_few" | null;
  ready_at?: string | null;
};

export const CROWD_MIN_PICKS = 5;

export type CrowdView = {
  n: number;
  homePct: number;
  awayPct: number;
  drawPct: number;
  /** Which side the crowd favors, or null when it is an exact split. */
  leader: "home" | "away" | null;
  leaderPct: number;
  confidence: "Lopsided" | "Leaning" | "Toss-up";
  avgText: string;
  spreadText: string;
  topText: string;
};

const one = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

export function crowdView(s: CrowdStats, home: string, away: string): CrowdView | null {
  if (!s.locked || !s.n) return null;
  const n = s.n;
  const homePct = Math.round(((s.home_n ?? 0) / n) * 100);
  const drawN = s.draw_n ?? 0;
  // Keep the three slices adding to exactly 100.
  const awayPct = drawN > 0 ? Math.round(((s.away_n ?? 0) / n) * 100) : 100 - homePct;
  const drawPct = Math.max(0, 100 - homePct - awayPct);
  const leader = homePct === awayPct ? null : homePct > awayPct ? "home" : "away";
  const leaderPct = Math.max(homePct, awayPct);
  const confidence = leaderPct >= 75 ? "Lopsided" : leaderPct >= 60 ? "Leaning" : "Toss-up";
  const m = s.avg_margin ?? 0;
  const spreadText = Math.abs(m) < 0.05 ? "Dead even" : `${m > 0 ? home : away} by ${one(Math.abs(m))}`;
  return {
    n, homePct, awayPct, drawPct, leader, leaderPct, confidence,
    avgText: `${one(s.avg_home ?? 0)} – ${one(s.avg_away ?? 0)}`,
    spreadText,
    topText: s.top_home != null ? `${s.top_home}–${s.top_away}` : "",
  };
}
