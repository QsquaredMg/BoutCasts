import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID } from "@/lib/schoolElection";
import { isHexColor, luminance } from "@/lib/liveVoteEvents/roomTheme";

// Winners graphic (1080x1350), generated from the final results once voting has closed.
// Uses the school's logo, banner and colors from setup. Vote counts only appear if the school left the tally on.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const admin = createAdminClient();
  const { data: el } = await admin
    .from("school_elections")
    .select("title, school_name, status, closes_at, show_tally, brand_logo_url, cover_image_url, brand_color, brand_bg_color")
    .eq("id", id)
    .maybeSingle();
  if (!el) return new Response("Not found", { status: 404 });
  const closed = el.status === "closed" || (el.closes_at != null && new Date(el.closes_at) <= new Date());
  if (!closed) return new Response("Results are hidden until voting closes.", { status: 403 });

  const { data: races } = await admin.from("live_vote_events").select("id, title").eq("election_id", id).order("election_sort");
  const rows: { office: string; winners: string; votes: string | null }[] = [];
  for (const r of races ?? []) {
    const [{ data: opts }, { data: tally }] = await Promise.all([
      admin.from("live_vote_options").select("id, name").eq("event_id", r.id),
      admin.rpc("get_live_vote_tally", { p_event_id: r.id }),
    ]);
    const counts = new Map<string, number>(((tally ?? []) as { option_id: string; votes: number | string }[]).map((t) => [t.option_id, Number(t.votes)]));
    const top = Math.max(0, ...(opts ?? []).map((o) => counts.get(o.id) ?? 0));
    const w = top > 0 ? (opts ?? []).filter((o) => (counts.get(o.id) ?? 0) === top) : [];
    rows.push({
      office: r.title,
      winners: w.length ? w.map((o) => o.name).join(" & ") : "No votes cast",
      votes: el.show_tally && w.length ? `${top} vote${top === 1 ? "" : "s"}` : null,
    });
  }

  const accent = isHexColor(el.brand_color) ? el.brand_color : "#2352E8";
  const bg = isHexColor(el.brand_bg_color) ? el.brand_bg_color : "#0B1020";
  const dark = luminance(bg) < 0.4;
  const text = dark ? "#ffffff" : "#0B1020";
  const sub = dark ? "rgba(255,255,255,0.75)" : "rgba(11,16,32,0.7)";
  const panel = dark ? "rgba(255,255,255,0.08)" : "rgba(11,16,32,0.06)";
  const shown = rows.slice(0, 8);
  const rowH = shown.length > 6 ? 108 : 128;
  const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: 1080, height: 1350, background: bg, color: text }}>
        <div style={{ display: "flex", position: "relative", width: 1080, height: 300, background: accent, alignItems: "flex-end" }}>
          {el.cover_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={el.cover_image_url} alt="" width={1080} height={300} style={{ position: "absolute", top: 0, left: 0, width: 1080, height: 300, objectFit: "cover" }} />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "0 56px", position: "absolute", bottom: -50, left: 0 }}>
            {el.brand_logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={el.brand_logo_url} alt="" width={120} height={120} style={{ width: 120, height: 120, objectFit: "contain", borderRadius: 24, background: "#fff", padding: 8 }} />
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: "76px 56px 0" }}>
          {el.school_name && <div style={{ display: "flex", fontSize: 30, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", color: accent }}>{clip(el.school_name, 40)}</div>}
          <div style={{ display: "flex", fontSize: 62, fontWeight: 900, lineHeight: 1.1, marginTop: 8 }}>{clip(el.title, 50)}</div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: sub, marginTop: 8 }}>Congratulations to our winners</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "30px 56px 0" }}>
          {shown.map((r) => (
            <div key={r.office} style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: rowH, padding: "0 30px", borderRadius: 22, background: panel, borderLeft: `10px solid ${accent}` }}>
              <div style={{ display: "flex", fontSize: 26, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: sub }}>{clip(r.office, 40)}</div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <div style={{ display: "flex", fontSize: 46, fontWeight: 900 }}>{clip(r.winners, 30)}</div>
                {r.votes && <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: sub }}>{r.votes}</div>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", position: "absolute", bottom: 36, left: 0, width: 1080, justifyContent: "center", fontSize: 24, color: sub }}>Powered by BoutCasts · boutcasts.com</div>
      </div>
    ),
    { width: 1080, height: 1350 },
  );
}
