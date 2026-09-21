import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { getRoundRecap, roundLabelFor } from "@/lib/recap";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({
  params,
}: {
  params: Promise<{ key: string; round: string }>;
}) {
  const { key, round } = await params;
  const roundNumber = Number(round);
  const supabase = await createClient();

  const recap = await getRoundRecap(supabase, key, roundNumber);

  const { data: allBouts } = await supabase
    .from("bouts")
    .select("round_number")
    .eq("bracket_key", key);
  const lastRound = Math.max(
    roundNumber,
    ...(allBouts ?? []).map((b) => b.round_number)
  );
  const label = roundLabelFor(roundNumber, lastRound);

  const winners = (recap?.bouts ?? [])
    .map((b) =>
      b.winner_side === "a"
        ? b.competitor_a_name
        : b.winner_side === "b"
        ? b.competitor_b_name
        : null
    )
    .filter((n): n is string => !!n);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(135deg, #0a0a0a 0%, #1c1917 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700, color: "#f87171", letterSpacing: 2 }}>
          BOUTCASTS
        </div>
        <div style={{ fontSize: 24, color: "#a3a3a3", marginTop: 8 }}>
          {recap?.categoryName ?? "Bracket"}
        </div>
        <div style={{ fontSize: 56, fontWeight: 800, marginTop: 16, display: "flex" }}>
          {label} Recap
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 32, gap: 16 }}>
          {winners.length > 0 ? (
            winners.slice(0, 4).map((w, i) => (
              <div key={i} style={{ fontSize: 32, display: "flex", alignItems: "center", gap: 12 }}>
                <span>🏆</span>
                <span style={{ fontWeight: 700 }}>{w}</span>
                <span style={{ color: "#a3a3a3" }}>advances</span>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 28, color: "#a3a3a3", display: "flex" }}>
              Voting in progress
            </div>
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
