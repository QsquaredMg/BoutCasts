import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: bout } = await supabase
    .from("bouts")
    .select("*, categories(name)")
    .eq("id", id)
    .maybeSingle();

  const { data: votes } = await supabase.from("votes").select("side").eq("bout_id", id);
  const tally = { a: 0, b: 0 };
  for (const v of votes ?? []) tally[v.side as "a" | "b"]++;
  const total = tally.a + tally.b;
  const pctA = total > 0 ? Math.round((tally.a / total) * 100) : 50;
  const pctB = 100 - pctA;

  const aWins = bout?.winner_side === "a";
  const bWins = bout?.winner_side === "b";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 64,
          background: "linear-gradient(160deg, #1c1d28 0%, #0a0b10 78%)",
          color: "#f5f4ef",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 18px",
              borderRadius: 16,
              background: "#ffffff",
            }}
          >
            <img
              src="https://www.boutcasts.com/boutcasts-logo.png"
              width={164}
              height={90}
              alt="BoutCasts"
              style={{ display: "flex" }}
            />
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 2,
              background: "rgba(255,255,255,0.12)",
              padding: "6px 16px",
              borderRadius: 999,
              display: "flex",
            }}
          >
            {bout?.categories?.name ?? "BoutCasts"}
          </div>
        </div>

        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#a97a12",
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: 4,
            marginTop: 24,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {bout?.status === "final" ? "FINAL RESULT" : "LIVE VOTE"}
        </div>

        <div style={{ display: "flex", alignItems: "center", flex: 1, gap: 32, marginTop: 24 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: 32,
              borderRadius: 24,
              background: aWins ? "rgba(169,122,18,0.22)" : "rgba(217,44,76,0.14)",
              border: `2px solid ${aWins ? "#a97a12" : "rgba(217,44,76,0.4)"}`,
            }}
          >
            <div style={{ fontSize: 34, fontWeight: 800, display: "flex" }}>
              {bout?.competitor_a_name ?? "Fighter A"}
            </div>
            <div style={{ fontSize: 48, fontWeight: 800, color: "#d92c4c", marginTop: 12, display: "flex" }}>
              {pctA}%
            </div>
          </div>

          <div style={{ fontSize: 40, fontWeight: 800, color: "rgba(255,255,255,0.7)", display: "flex" }}>
            VS
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: 32,
              borderRadius: 24,
              background: bWins ? "rgba(169,122,18,0.22)" : "rgba(31,95,214,0.14)",
              border: `2px solid ${bWins ? "#a97a12" : "rgba(31,95,214,0.4)"}`,
            }}
          >
            <div style={{ fontSize: 34, fontWeight: 800, display: "flex" }}>
              {bout?.competitor_b_name ?? "Fighter B"}
            </div>
            <div style={{ fontSize: 48, fontWeight: 800, color: "#1f5fd6", marginTop: 12, display: "flex" }}>
              {pctB}%
            </div>
          </div>
        </div>

        <div style={{ fontSize: 18, color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 24, display: "flex", justifyContent: "center" }}>
          {total} votes cast — vote now at boutcasts.com
        </div>
      </div>
    ),
    { ...size }
  );
}
