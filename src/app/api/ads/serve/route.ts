import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deviceFromUa, isBot, pathFromReferer, sidFromCookieHeader } from "@/lib/analytics/ua";

// Serves one active ad creative for the requested placement, weighted-random
// among everything currently in flight, and logs an impression for it.
// This is the single "ad firing" entry point every placement on the site
// calls through, so reporting in the admin Ad Manager stays accurate.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const placement = searchParams.get("placement") ?? "interstitial";

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  let query = supabase
    .from("ad_creatives")
    .select("id, sponsor_id, placement, media_type, media_url, click_url, headline, weight, sponsors(name)")
    .eq("placement", placement)
    .eq("status", "active");
  // Pre-rolls must be playable files (the player waits for them to end).
  if (placement === "preroll") query = query.in("media_type", ["image", "video"]);
  const { data: candidates, error } = await query
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ad: null });
  }

  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * totalWeight;
  let chosen = candidates[0];
  for (const c of candidates) {
    roll -= c.weight;
    if (roll <= 0) {
      chosen = c;
      break;
    }
  }

  const { data: userData } = await supabase.auth.getUser();
  // Crawlers still get an ad (so pages render the same) but are not counted,
  // which keeps impression numbers honest for advertisers.
  const ua = req.headers.get("user-agent");
  if (!isBot(ua)) {
    await supabase.from("ad_events").insert({
      ad_id: chosen.id,
      event_type: "impression",
      user_id: userData.user?.id ?? null,
      session_id: sidFromCookieHeader(req.headers.get("cookie")),
      path: pathFromReferer(req.headers.get("referer")),
      device: deviceFromUa(ua),
      country: req.headers.get("x-vercel-ip-country"),
    });
  }

  const sponsorName = Array.isArray(chosen.sponsors)
    ? chosen.sponsors[0]?.name
    : (chosen.sponsors as { name: string } | null)?.name;

  return NextResponse.json({
    ad: {
      id: chosen.id,
      mediaType: chosen.media_type,
      mediaUrl: chosen.media_url,
      clickUrl: chosen.click_url,
      headline: chosen.headline,
      sponsorName: sponsorName ?? "BoutCasts partner",
    },
  });
}
