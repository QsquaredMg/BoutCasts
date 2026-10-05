// Bout Predictions grading scale. Mirrors the SQL function public.pred_grade.
//   Entering a prediction ......................... +2
//   Correct winner (or a correct draw call) ....... +3
//   Both scores exact ............................. +6
//   Exactly one score right ....................... +2
//   Combined miss (home + away) of 1-2 ............ +2
//   Combined miss of 3-5 .......................... +1
// A perfect call earns 2 + 3 + 6 = 11 points.

export type Score = { home: number; away: number };

export type PredictionPoints = {
  entry: number;
  winner: number;
  exact: number;
  close: number;
  total: number;
};

export const SCORING = {
  entry: 2,
  winner: 3,
  bothExact: 6,
  oneExact: 2,
  closeNear: 2,
  closeFar: 1,
  perfect: 11,
} as const;

export function gradePrediction(pred: Score, actual: Score): PredictionPoints {
  const entry = SCORING.entry;
  const winner = Math.sign(pred.home - pred.away) === Math.sign(actual.home - actual.away) ? SCORING.winner : 0;
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
