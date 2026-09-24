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

  const { data: event } = await supabase
    .from("live_vote_events")
    .select("title, brand_name, brand_logo_url, status")
    .eq("id", id)
    .maybeSingle();

  const { data: options } = await supabase
    .from("live_vote_options")
    .select("id")
    .eq("event_id", id);
  const optionCount = options?.length ?? 0;

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
          {event?.brand_name && (
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
              Presented by {event.brand_name}
            </div>
          )}
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
          {event?.status === "closed" ? "FINAL RESULTS" : "LIVE VOTE EVENT"}
        </div>

        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            textAlign: "center",
            marginTop: 16,
            display: "flex",
            justifyContent: "center",
            flex: 1,
            alignItems: "center",
          }}
        >
          {event?.title ?? "BoutCasts Live Vote"}
        </div>

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
          {optionCount > 0 ? `${optionCount} option${optionCount === 1 ? "" : "s"} — ` : ""}
          Cast your vote at boutcasts.com — or start your own Bout
        </div>
      </div>
    ),
    { ...size }
  );
}
