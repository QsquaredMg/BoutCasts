import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const supabase = await createClient();

  const { data: boutsRaw } = await supabase
    .from("bouts")
    .select("round_number, status, competitor_a_name, competitor_b_name, winner_side, categories(name)")
    .eq("bracket_key", key)
    .order("round_number", { ascending: true });

  const bouts = boutsRaw ?? [];
  const first = bouts[0] as { categories?: { name: string } | { name: string }[] | null } | undefined;
  const categoryName = Array.isArray(first?.categories) ? first?.categories[0]?.name : first?.categories?.name;

  const lastRound = Math.max(1, ...bouts.map((b) => b.round_number));
  const finalBout = bouts.find((b) => b.round_number === lastRound);
  const finalIsDone = finalBout?.status === "final";
  const rounds = new Set(bouts.map((b) => b.round_number)).size;

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
            {rounds} round{rounds === 1 ? "" : "s"}
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
          {finalIsDone ? "CHAMPION CROWNED" : "TOURNAMENT BRACKET"}
        </div>

        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            textAlign: "center",
            marginTop: 16,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {categoryName ?? "BoutCasts"}
        </div>

        {finalBout && (finalBout.competitor_a_name || finalBout.competitor_b_name) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
              marginTop: 40,
              flex: 1,
            }}
          >
            <div
              style={{
                fontSize: 36,
                fontWeight: 800,
                display: "flex",
                color: finalBout.winner_side === "a" ? "#a97a12" : "#f5f4ef",
              }}
            >
              {finalBout.competitor_a_name || "TBD"}
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "rgba(255,255,255,0.6)", display: "flex" }}>VS</div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 800,
                display: "flex",
                color: finalBout.winner_side === "b" ? "#a97a12" : "#f5f4ef",
              }}
            >
              {finalBout.competitor_b_name || "TBD"}
            </div>
          </div>
        )}

        <div
          style={{
            fontSize: 18,
            color: "rgba(255,255,255,0.5)",
            textAlign: "center",
            marginTop: 24,
            display: "flex",
            justifyContent: "center",
          }}
        >
          Vote now at boutcasts.com — or start your own Bout
        </div>
      </div>
    ),
    { ...size }
  );
}
