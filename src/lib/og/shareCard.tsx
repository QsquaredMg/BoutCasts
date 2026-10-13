import { ImageResponse } from "next/og";
import { logoDataUrl, SponsorBar, type OgSponsor } from "@/lib/og/sponsor";
import { zoneAbbr } from "@/lib/time/zones";

// One share card for every kind of BoutCasts event. Link previews (1200x630) and the
// shareable graphic (1080x1350) are drawn from the same data, so they always agree on
// what is being shared: the TYPE of event, who is in it, when it starts and when voting
// or picks close. A server-drawn image can't know the viewer's time zone, so each time is
// shown in Eastern, Central and Pacific.

export type CardType = "predictions" | "bout" | "bracket" | "livevote" | "competition" | "showcase" | "debate" | "paidbout" | "trivia";

export const CARD_LABEL: Record<CardType, string> = {
  predictions: "Predictions",
  bout: "Bout",
  bracket: "Bracket",
  livevote: "Live Vote",
  competition: "Competition",
  showcase: "Showcase",
  debate: "Debate",
  paidbout: "Paid Bout",
  trivia: "Live Trivia",
};

const THEME: Record<CardType, { bg: string; accent: string }> = {
  predictions: { bg: "linear-gradient(135deg, #0b1a4a 0%, #1b4fe4 100%)", accent: "#ffd36b" },
  bout: { bg: "linear-gradient(160deg, #1c1d28 0%, #0a0b10 78%)", accent: "#ff5a6e" },
  bracket: { bg: "linear-gradient(160deg, #1c1d28 0%, #0a0b10 78%)", accent: "#ffd36b" },
  livevote: { bg: "linear-gradient(160deg, #4a0f1a 0%, #1a0509 80%)", accent: "#f0c35a" },
  competition: { bg: "linear-gradient(160deg, #1a2160 0%, #0b1030 80%)", accent: "#ff7a59" },
  showcase: { bg: "linear-gradient(160deg, #3a1a78 0%, #170a35 80%)", accent: "#b69cff" },
  debate: { bg: "linear-gradient(160deg, #14307a 0%, #0a1030 80%)", accent: "#7fb0ff" },
  paidbout: { bg: "linear-gradient(160deg, #0b4a38 0%, #06241b 80%)", accent: "#3fe0a8" },
  trivia: { bg: "linear-gradient(160deg, #3b1a6e 0%, #0a0e1a 80%)", accent: "#ffc531" },
};

export type Contender = { name: string; img: string | null; color?: string };

export type CardData = {
  type: CardType;
  /** Small line above the contenders, e.g. a category or "Private game". */
  kicker?: string | null;
  /** The event's own name (room, bracket or topic title). */
  title?: string | null;
  contenders: Contender[];
  /** Extra count when there are more contenders than shown. */
  more?: number;
  startMs?: number | null;
  startLabel?: string;
  closeMs?: number | null;
  closeLabel: string;
  /** Short facts such as "$25 entry" or "12 votes". */
  facts?: string[];
  sponsor?: OgSponsor | null;
  /** Vote share for a head to head, shown under each name. */
  pct?: [number, number] | null;
  /** Index of the winner (0 or 1). */
  winner?: 0 | 1 | null;
  /** Invitation line at the bottom of the portrait graphic. */
  cta?: string;
};

const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const ZONE3 = ["America/New_York", "America/Chicago", "America/Los_Angeles"];

/** "Sat, Oct 10" and "7:00 PM ET · 6:00 PM CT · 4:00 PM PT" for one moment. */
export function threeZones(ms: number) {
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" }).format(new Date(ms));
  const times = ZONE3.map((tz) => {
    const t = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(ms));
    return `${t.replace(/\s/g, " ")} ${zoneAbbr(ms, tz)}`;
  });
  return { day, line: times.join(" · ") };
}

/** The same facts as one plain sentence, for page descriptions and share captions. */
export function whenSentence(d: Pick<CardData, "startMs" | "startLabel" | "closeMs" | "closeLabel">) {
  const parts: string[] = [];
  if (d.startMs) {
    const z = threeZones(d.startMs);
    parts.push(`${d.startLabel ?? "Starts"} ${z.day}, ${z.line}`);
  }
  if (d.closeMs) {
    const z = threeZones(d.closeMs);
    parts.push(`${d.closeLabel} ${z.day}, ${z.line}`);
  }
  return parts.join(". ");
}

/** Title and description for a page's link preview, built from the same card data. */
export function cardMeta(d: CardData, headline: string) {
  const label = CARD_LABEL[d.type];
  const when = whenSentence(d);
  return { title: `${headline} · ${label}`, description: `${label}${d.kicker ? ` · ${d.kicker}` : ""}.${when ? ` ${when}.` : ""} On BoutCasts.` };
}

/** YouTube thumbnail for a video link, inlined; any other source has no photo. */
export async function videoThumb(sourceType: string | null | undefined, url: string | null | undefined): Promise<string | null> {
  if (!url || sourceType === "upload" || sourceType === "record") return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? logoDataUrl(`https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`) : null;
}

function Avatar({ c, box, font, max, round }: { c: Contender; box: number; font: number; max: number; round?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: box + 40 }}>
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", width: box, height: box,
          borderRadius: round ? box : box * 0.16, background: c.img ? "#ffffff" : (c.color ?? "#e9edf7"), overflow: "hidden",
        }}
      >
        {c.img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.img} alt="" width={box} height={box} style={{ objectFit: "cover", width: box, height: box }} />
        ) : (
          <div style={{ display: "flex", fontSize: box * 0.38, fontWeight: 900, color: c.color ? "#ffffff" : "#0b1a4a" }}>{initials(c.name)}</div>
        )}
      </div>
      <div style={{ display: "flex", textAlign: "center", justifyContent: "center", marginTop: 12, fontSize: font, fontWeight: 900, lineHeight: 1.1, color: "#ffffff", maxWidth: box + 40 }}>
        {clip(c.name, max)}
      </div>
    </div>
  );
}

function WhenRow({ label, ms, big, accent }: { label: string; ms: number; big: boolean; accent: string }) {
  const z = threeZones(ms);
  return (
    <div style={{ display: "flex", flexDirection: big ? "column" : "row", alignItems: "center", justifyContent: "center", marginTop: big ? 14 : 6 }}>
      <div style={{ display: "flex", fontSize: big ? 26 : 18, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: accent, marginRight: big ? 0 : 14, marginBottom: big ? 4 : 0 }}>
        {label}
      </div>
      <div style={{ display: "flex", fontSize: big ? 36 : 24, fontWeight: 800, color: "#ffffff" }}>{`${z.day} · ${z.line}`}</div>
    </div>
  );
}

export function renderCard(d: CardData, variant: "og" | "story") {
  const og = variant === "og";
  const w = og ? 1200 : 1080;
  const h = og ? 630 : 1350;
  const th = THEME[d.type];
  const n = d.contenders.length;
  const box = n <= 2 ? (d.pct ? (og ? 140 : 280) : (og ? 170 : 300)) : n === 3 ? (og ? 140 : 250) : (og ? 110 : 200);
  const nameFont = og ? (n > 2 ? 22 : d.pct ? 26 : 32) : (n > 2 ? 34 : 46);
  const two = n === 2;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "space-between", padding: og ? "22px 56px" : "64px 40px",
          background: th.bg, color: "#ffffff", fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "8px 20px", borderRadius: 20, background: "#ffffff" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://www.boutcasts.com/boutcasts-logo.png" width={og ? 92 : 170} height={og ? 50 : 93} alt="BoutCasts" />
          </div>
          <div
            style={{
              display: "flex", fontSize: og ? 26 : 40, fontWeight: 900, letterSpacing: 3, textTransform: "uppercase",
              color: "#0a0e1a", background: th.accent, padding: og ? "8px 22px" : "12px 32px", borderRadius: 999,
            }}
          >
            {CARD_LABEL[d.type]}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          {d.kicker && (
            <div style={{ display: "flex", fontSize: og ? 22 : 34, fontWeight: 800, color: th.accent, marginBottom: og ? 8 : 24, textAlign: "center", justifyContent: "center" }}>
              {clip(d.kicker, 60)}
            </div>
          )}
          {n > 0 && (
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", width: w - 100 }}>
              {d.contenders.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start" }}>
                  {two && i === 1 && (
                    <div style={{ display: "flex", fontSize: og ? 56 : 84, fontWeight: 900, margin: og ? "0 22px" : "0 6px", marginTop: box / 2 - (og ? 34 : 50) }}>VS</div>
                  )}
                  {!two && i > 0 && <div style={{ display: "flex", width: og ? 14 : 12 }} />}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <Avatar c={c} box={box} font={nameFont} max={n > 2 ? 20 : 32} />
                    {d.pct && two && (
                      <div style={{ display: "flex", marginTop: 6, fontSize: og ? 34 : 60, fontWeight: 900, color: d.winner === i ? "#ffd36b" : "#ffffff" }}>
                        {`${d.pct[i]}%${d.winner === i ? " 🏆" : ""}`}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {!!d.more && (
                <div style={{ display: "flex", fontSize: og ? 36 : 56, fontWeight: 900, alignSelf: "center", marginLeft: 18 }}>{`+${d.more}`}</div>
              )}
            </div>
          )}
          {d.title && (
            <div
              style={{
                display: "flex", marginTop: n > 0 ? (og ? 12 : 36) : 0, fontSize: n > 0 ? (og ? 28 : 46) : (og ? 56 : 80), fontWeight: 800,
                textAlign: "center", justifyContent: "center", maxWidth: w - 120, lineHeight: 1.15,
              }}
            >
              {clip(d.title, n > 0 ? 70 : 90)}
            </div>
          )}
          {d.facts && d.facts.length > 0 && (
            <div style={{ display: "flex", marginTop: og ? 8 : 20, fontSize: og ? 22 : 34, fontWeight: 700, color: "rgba(255,255,255,.85)" }}>
              {d.facts.join(" · ")}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          {d.startMs ? <WhenRow label={d.startLabel ?? "Starts"} ms={d.startMs} big={!og} accent={th.accent} /> : null}
          {d.closeMs ? (
            <WhenRow label={d.closeLabel} ms={d.closeMs} big={!og} accent={th.accent} />
          ) : (
            <div style={{ display: "flex", fontSize: og ? 24 : 36, fontWeight: 800, marginTop: 6 }}>{d.closeLabel}</div>
          )}
          {d.sponsor && (
            <div style={{ display: "flex", marginTop: og ? 10 : 28 }}>
              <SponsorBar sponsor={d.sponsor} scale={og ? 0.55 : 0.9} />
            </div>
          )}
          {!og && (
            <div style={{ display: "flex", fontSize: 30, fontWeight: 600, marginTop: 24, color: "rgba(255,255,255,.85)", textAlign: "center", justifyContent: "center" }}>
              {d.cta ?? "Join in at boutcasts.com"}
            </div>
          )}
        </div>
      </div>
    ),
    { width: w, height: h },
  );
}

export const EMPTY_CARD: CardData = { type: "bout", contenders: [], title: "BoutCasts", closeLabel: "Vote on boutcasts.com" };
