import { ImageResponse } from "next/og";
import type { TopRow, SocialKind } from "./types";

const LABEL: Record<SocialKind, string> = {
  bout: "Bout result", bout_launch: "New bout", paidbout_launch: "Paid bout", bracket: "Bracket champion", livevote: "Live vote results", predictions: "Prediction leaderboard", trivia: "Trivia results",
};
const MEDAL = ["#ffd36b", "#d7dbe6", "#e0a070"];
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Portrait results graphic (1080x1350): winner on top, ranked top 10 below. */
export function renderResultsCard(d: { kind: SocialKind; title: string; winner: string | null; top10: TopRow[] }) {
  const rows = d.top10.slice(0, 10);
  const rowH = rows.length > 7 ? 70 : 84;
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

        {rows.length > 1 && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 36, gap: 10 }}>
            {rows.map((r) => (
              <div key={r.rank} style={{ display: "flex", alignItems: "center", height: rowH, padding: "0 28px", borderRadius: 18, background: r.rank === 1 ? "rgba(255,211,107,0.18)" : "rgba(255,255,255,0.07)" }}>
                <div style={{ display: "flex", width: 70, fontSize: 40, fontWeight: 900, color: MEDAL[r.rank - 1] ?? "#9aa3bd" }}>{r.rank}</div>
                <div style={{ display: "flex", flex: 1, fontSize: 38, fontWeight: 800 }}>{clip(r.name, 24)}</div>
                <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#c9cfe2" }}>{clip(r.score, 22)}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", marginTop: "auto", justifyContent: "center", fontSize: 34, fontWeight: 800, color: "#c9cfe2" }}>
          Vote on the next one at boutcasts.com
        </div>
      </div>
    ),
    { width: 1080, height: 1350 }
  );
}
