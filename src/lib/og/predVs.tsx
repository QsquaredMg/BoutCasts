import { ImageResponse } from "next/og";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logoDataUrl } from "@/lib/og/sponsor";

// The "TEAM A vs TEAM B" graphic for Bout Predictions: used as the link preview (1200x630)
// and as the shareable image (1080x1350). Team logos are inlined so a slow image can't break it.

export type VsData = {
  home: string; away: string; homeLogo: string | null; awayLogo: string | null;
  whenText: string; isPrivate: boolean; title: string | null;
};

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export async function loadVsForGame(supabase: SupabaseClient, gameId: string): Promise<VsData | null> {
  const { data: g } = await supabase
    .from("pred_games")
    .select("home_name, away_name, home_logo, away_logo, starts_at, is_private, slate_id")
    .eq("id", gameId)
    .maybeSingle();
  if (!g) return null;
  return buildVs(g);
}

export async function loadVsForSlate(supabase: SupabaseClient, slateId: string): Promise<VsData | null> {
  const { data: s } = await supabase.from("pred_slates").select("title, visibility").eq("id", slateId).maybeSingle();
  if (!s) return null;
  const { data: games } = await supabase
    .from("pred_games")
    .select("home_name, away_name, home_logo, away_logo, starts_at, is_private, slate_id")
    .eq("slate_id", slateId)
    .neq("status", "cancelled")
    .order("starts_at")
    .limit(2);
  const g = games?.[0];
  if (!g) return null;
  const v = await buildVs(g);
  return { ...v, title: s.title, isPrivate: s.visibility === "private" };
}

async function buildVs(g: { home_name: string; away_name: string; home_logo: string | null; away_logo: string | null; starts_at: string; is_private: boolean }): Promise<VsData> {
  const [homeLogo, awayLogo] = await Promise.all([logoDataUrl(g.home_logo), logoDataUrl(g.away_logo)]);
  const when = new Date(g.starts_at);
  const whenText =
    when.getTime() > Date.now()
      ? `Starts ${when.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET`
      : "Make your picks";
  return { home: g.home_name, away: g.away_name, homeLogo, awayLogo, whenText, isPrivate: g.is_private, title: null };
}

function Team({ name, logo, box, font }: { name: string; logo: string | null; box: number; font: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: box + 60 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: box, height: box, borderRadius: box * 0.16, background: "#ffffff", overflow: "hidden" }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" width={box - 28} height={box - 28} style={{ objectFit: "contain" }} />
        ) : (
          <div style={{ display: "flex", fontSize: box * 0.38, fontWeight: 900, color: "#0b1a4a" }}>{initials(name)}</div>
        )}
      </div>
      <div style={{ display: "flex", textAlign: "center", justifyContent: "center", marginTop: 14, fontSize: font, fontWeight: 900, lineHeight: 1.1, color: "#ffffff", maxWidth: box + 60 }}>
        {name.length > 22 ? `${name.slice(0, 21)}…` : name}
      </div>
    </div>
  );
}

export function vsImage(d: VsData, variant: "og" | "story") {
  const og = variant === "og";
  const w = og ? 1200 : 1080;
  const h = og ? 630 : 1350;
  const box = og ? 180 : 300;
  const nameFont = og ? 34 : 48;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "space-between", padding: og ? "24px 56px" : "70px 40px",
          background: "linear-gradient(135deg, #0b1a4a 0%, #1b4fe4 100%)", color: "#ffffff", fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 24px", borderRadius: 22, background: "#ffffff" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://www.boutcasts.com/boutcasts-logo.png" width={og ? 110 : 210} height={og ? 60 : 115} alt="BoutCasts" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: og ? 26 : 42, fontWeight: 800, color: "#ffd36b", marginBottom: og ? 12 : 36 }}>
            {d.isPrivate ? "🔒 Private game · Bout Predictions" : "Bout Predictions"}
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", width: w - 100 }}>
            <Team name={d.home} logo={d.homeLogo} box={box} font={nameFont} />
            <div style={{ display: "flex", fontSize: og ? 64 : 90, fontWeight: 900, margin: og ? "0 28px" : "0 8px", marginTop: box / 2 - (og ? 38 : 54), color: "#ffffff" }}>VS</div>
            <Team name={d.away} logo={d.awayLogo} box={box} font={nameFont} />
          </div>
          {d.title && (
            <div style={{ display: "flex", marginTop: og ? 12 : 44, fontSize: og ? 26 : 44, fontWeight: 800, textAlign: "center", justifyContent: "center", maxWidth: w - 140 }}>
              {d.title.length > 60 ? `${d.title.slice(0, 59)}…` : d.title}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: og ? 28 : 46, fontWeight: 800 }}>{d.whenText}</div>
          {!og && (
            <div style={{ display: "flex", fontSize: 32, fontWeight: 600, marginTop: 10, color: "rgba(255,255,255,.85)", textAlign: "center", justifyContent: "center" }}>
              Call the winner and the score at boutcasts.com/predictions
            </div>
          )}
        </div>
      </div>
    ),
    { width: w, height: h },
  );
}
