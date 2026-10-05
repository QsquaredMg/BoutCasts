// Bout Predictions grading scale. Mirrors the SQL function public.pred_grade.
//   Correct winner (or a correct draw call) ....... +5   (games made before Oct 5 2026: +3, plus +2 for entering)
//   Both scores exact ............................. +6
//   Exactly one score right ....................... +2
//   Combined miss (home + away) of 1-2 ............ +2
//   Combined miss of 3-5 .......................... +1
// A perfect call earns 5 + 6 = 11 points.

export type Score = { home: number; away: number };

export type PredictionPoints = {
  entry: number;
  winner: number;
  exact: number;
  close: number;
  total: number;
};

export const SCORING = {
  entry: 0,
  winner: 5,
  bothExact: 6,
  oneExact: 2,
  closeNear: 2,
  closeFar: 1,
  perfect: 11,
} as const;

export function gradePrediction(pred: Score, actual: Score, version = 2): PredictionPoints {
  const entry = version === 1 ? 2 : SCORING.entry;
  const winPts = version === 1 ? 3 : SCORING.winner;
  const winner = Math.sign(pred.home - pred.away) === Math.sign(actual.home - actual.away) ? winPts : 0;
  const homeHit = pred.home === actual.home;
  const awayHit = pred.away === actual.away;
  const exact = homeHit && awayHit ? SCORING.bothExact : homeHit || awayHit ? SCORING.oneExact : 0;
  const miss = Math.abs(pred.home - actual.home) + Math.abs(pred.away - actual.away);
  const close = miss >= 1 && miss <= 2 ? SCORING.closeNear : miss >= 3 && miss <= 5 ? SCORING.closeFar : 0;
  return { entry, winner, exact, close, total: entry + winner + exact + close };
}

export function pickFor(home: number, away: number): "home" | "away" | "draw" {
  return home > away ? "home" : away > home ? "away" : "draw";
}
