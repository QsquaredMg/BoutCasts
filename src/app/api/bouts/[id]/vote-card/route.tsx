import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: bout } = await supabase
    .from("bouts")
    .select("title, competitor_a_name, competitor_b_name, categories(name)")
    .eq("id", id)
    .maybeSingle();

  if (!bout) {
    return new Response("Not found", { status: 404 });
  }

  const categoriesJoin = bout.categories as unknown as { name: string }[] | { name: string } | null;
  const categoryName = (Array.isArray(categoriesJoin) ? categoriesJoin[0]?.name : categoriesJoin?.name) ?? "BoutCasts";

  const { data: votes } = await supabase.from("votes").select("side").eq("bout_id", id);
  const tally = { a: 0, b: 0 };
  for (const v of votes ?? []) tally[v.side as "a" | "b"]++;
  const total = tally.a + tally.b;
  const pctA = total > 0 ? Math.round((tally.a / total) * 100) : 50;
  const pctB = 100 - pctA;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 72,
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
              width={150}
              height={82}
              alt="BoutCasts"
              style={{ display: "flex" }}
            />
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 2,
              background: "rgba(255,255,255,0.12)",
              padding: "6px 16px",
              borderRadius: 999,
              display: "flex",
            }}
          >
            {categoryName}
          </div>
        </div>

        <div
          style={{
            fontSize: 44,
            fontWeight: 800,
            color: "#d92c4c",
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: 4,
            marginTop: 40,
            display: "flex",
            justifyContent: "center",
          }}
        >
          CAST YOUR VOTE
        </div>

        <div
          style={{
            fontSize: 24,
            color: "rgba(255,255,255,0.75)",
            textAlign: "center",
            marginTop: 8,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {bout.title}
        </div>

        <div style={{ display: "flex", alignItems: "center", flex: 1, gap: 32, marginTop: 40 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: 40,
              borderRadius: 28,
              background: "rgba(217,44,76,0.14)",
              border: "3px solid rgba(217,44,76,0.5)",
            }}
          >
            <div style={{ fontSize: 38, fontWeight: 800, display: "flex", textAlign: "center" }}>
              {bout.competitor_a_name}
            </div>
            <div style={{ fontSize: 64, fontWeight: 800, color: "#d92c4c", marginTop: 16, display: "flex" }}>
              {pctA}%
            </div>
          </div>

          <div style={{ fontSize: 44, fontWeight: 800, color: "rgba(255,255,255,0.7)", display: "flex" }}>
            VS
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: 40,
              borderRadius: 28,
              background: "rgba(31,95,214,0.14)",
              border: "3px solid rgba(31,95,214,0.5)",
            }}
          >
            <div style={{ fontSize: 38, fontWeight: 800, display: "flex", textAlign: "center" }}>
              {bout.competitor_b_name}
            </div>
            <div style={{ fontSize: 64, fontWeight: 800, color: "#1f5fd6", marginTop: 16, display: "flex" }}>
              {pctB}%
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: 20,
            color: "rgba(255,255,255,0.55)",
            textAlign: "center",
            marginTop: 32,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {total} vote{total === 1 ? "" : "s"} so far — cast yours at boutcasts.com
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  );
}
