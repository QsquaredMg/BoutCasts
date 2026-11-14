// Bout Predictions grading scales. They mirror the SQL functions public.pred_grade and
// public.pred_grade_ver (docs/sql/scoring_v3.sql). A game keeps the version it was created with.
//
// Version 3 (games created from Nov 14 2026): a sliding scale that adapts to the size of the game.
//   Correct winner (or a correct draw call) ....... +5
//   Margin of victory ............................. up to +3, fading with the error
//   Combined total score .......................... up to +2, fading with the error
//   Both scores exact ............................. +1
//   A wrong winner keeps half of the margin + total credit.
//   A perfect call earns 5 + 3 + 2 + 1 = 11 points.
//
// Version 2 (games created before that; SCORING below):
//   Correct winner (or a correct draw call) ....... +5
//   Both scores exact ............................. +6
//   Exactly one score right ....................... +2
//   Combined miss (home + away) of 1-2 ............ +2
//   Combined miss of 3-5 .......................... +1
// A perfect call earns 5 + 6 = 11 points.
// Version 1 (games made before Oct 5 2026): winner +3, plus +2 for entering.

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

/** Version 3 (current): the points players can earn, for the "How it works" page. */
export const SCORING_V3 = {
  winner: 5,
  margin: 3,
  total: 2,
  exact: 1,
  perfect: 11,
} as const;

/** The scoring version new games are created with. Matches the database default. */
export const CURRENT_SCORING_VERSION = 3;

export function gradePrediction(pred: Score, actual: Score, version = 2): PredictionPoints {
  if (version >= 3) {
    const pm = pred.home - pred.away;
    const am = actual.home - actual.away;
    const at = actual.home + actual.away;
    const winner = Math.sign(pm) === Math.sign(am) ? SCORING_V3.winner : 0;
    const exact = pred.home === actual.home && pred.away === actual.away ? SCORING_V3.exact : 0;
    const marginFit = Math.max(0, 1 - Math.abs(pm - am) / Math.max(3, 0.25 * at));
    const totalFit = Math.max(0, 1 - Math.abs(pred.home + pred.away - at) / Math.max(4, 0.4 * at));
    let raw = SCORING_V3.margin * marginFit + SCORING_V3.total * totalFit;
    if (winner === 0) raw *= 0.5;
    const close = Math.round(raw);
    return { entry: 0, winner, exact, close, total: winner + exact + close };
  }
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
