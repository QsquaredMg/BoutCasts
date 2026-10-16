import { ImageResponse } from "next/og";
import { PICK_LAUNCH_KINDS, type TopRow, type SocialKind } from "./types";

const LABEL: Record<SocialKind, string> = {
  bout: "Bout result", bout_launch: "New bout", paidbout_launch: "Paid bout", bracket: "Bracket champion", livevote: "Live vote results", predictions: "Prediction leaderboard", trivia: "Trivia results",
  predictions_launch: "Pick'em open", predbracket_launch: "Bracket open", bracket_launch: "Bracket open",
};
const FOOTER: Partial<Record<SocialKind, string>> = {
  predictions_launch: "Make your picks at boutcasts.com",
  predbracket_launch: "Fill out your bracket at boutcasts.com",
  bracket_launch: "Vote every round at boutcasts.com",
};
const MEDAL = ["#ffd36b", "#d7dbe6", "#e0a070"];
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Portrait results graphic (1080x1350): winner on top, ranked top 10 below. */
export function renderResultsCard(d: { kind: SocialKind; title: string; winner: string | null; top10: TopRow[] }) {
  const rows = d.top10.slice(0, 10);
  const rowH = rows.length > 7 ? 70 : 84;
  const launch = PICK_LAUNCH_KINDS.includes(d.kind); // a new game: matchups plus a "make your picks" call to action
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: 1080, height: 1350, padding: 56, color: "#fff", background: "linear-gradient(160deg, #1c1d28 0%, #0a0b10 78%)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", padding: "8px 20px", borderRadius: 20, background: "#fff" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://www.boutcasts.com/boutcasts-logo.png" width={170} height={93} alt="BoutCasts" />
          </div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 900, letterSpacing: 3, textTransform: "uppercase", color: "#0a0e1a", background: "#ffd36b", padding: "12px 30px", borderRadius: 999 }}>
            {LABEL[d.kind]}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 44, textAlign: "center" }}>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 900, lineHeight: 1.1, justifyContent: "center" }}>{clip(d.title, 60)}</div>
          {d.winner && (
            <div style={{ display: "flex", marginTop: 22, fontSize: 64, fontWeight: 900, color: "#ffd36b", justifyContent: "center" }}>
              {`🏆 ${clip(d.winner, 28)}`}
            </div>
          )}
        </div>

        {rows.length > (launch ? 0 : 1) && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 36, gap: 10 }}>
            {rows.map((r) => (
              <div key={r.rank} style={{ display: "flex", alignItems: "center", height: rowH, padding: "0 28px", borderRadius: 18, background: r.rank === 1 && !launch ? "rgba(255,211,107,0.18)" : "rgba(255,255,255,0.07)" }}>
                <div style={{ display: "flex", width: 70, fontSize: 40, fontWeight: 900, color: launch ? "#ffd36b" : MEDAL[r.rank - 1] ?? "#9aa3bd" }}>{launch ? "•" : r.rank}</div>
                <div style={{ display: "flex", flex: 1, fontSize: launch ? 32 : 38, fontWeight: 800 }}>{clip(r.name, launch ? 34 : 24)}</div>
                <div style={{ display: "flex", fontSize: launch ? 26 : 30, fontWeight: 700, color: "#c9cfe2" }}>{clip(r.score, 22)}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", marginTop: "auto", justifyContent: "center", fontSize: 34, fontWeight: 800, color: "#c9cfe2" }}>
          {FOOTER[d.kind] ?? "Vote on the next one at boutcasts.com"}
        </div>
      </div>
    ),
    { width: 1080, height: 1350 }
  );
}
