import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deviceFromUa, isBot, pathFromReferer, sidFromCookieHeader } from "@/lib/analytics/ua";
import { LOCAL_BOOST, isLocal, matchesGeo, visitorGeo } from "@/lib/ads/geo";

// Serves one active ad creative for the requested placement, weighted-random
// among everything currently in flight, and logs an impression for it.
// This is the single "ad firing" entry point every placement on the site
// calls through, so reporting in the admin Ad Manager stays accurate.
//
// Creatives with a max_impressions cap stop serving once delivered. The cap is
// enforced atomically in the database (claim_ad_impression), so simultaneous
// requests can never overshoot it. Crawlers still get an ad (so pages render
// the same) but are neither counted against the cap nor logged, which keeps
// impression numbers honest for advertisers.
//
// Geo targeting: a creative is national, limited to US states, or limited to a radius
// around a point. The visitor's location comes from Vercel's IP headers (city level),
// or from ?lat=&lng=&region= when the page knows its venue. Local ads that match get
// a delivery boost over national ones; local ads never show where the location is
// unknown. Only the visitor's state is logged, never coordinates.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const placement = searchParams.get("placement") ?? "interstitial";

  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const ua = req.headers.get("user-agent");
  const bot = isBot(ua);
  const geo = visitorGeo(req.headers, searchParams);

  let query = supabase
    .from("ad_creatives")
    .select(
      "id, sponsor_id, placement, media_type, media_url, click_url, headline, weight, max_impressions, impressions_served, geo_scope, geo_states, geo_lat, geo_lng, geo_radius_miles, sponsors(name)"
    )
    .eq("placement", placement)
    .eq("status", "active");
  // Pre-rolls must be playable files (the player waits for them to end).
  if (placement === "preroll") query = query.in("media_type", ["image", "video"]);
  const { data, error } = await query
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Drop creatives that have already delivered their cap.
  // Keep only creatives that are under their cap and aimed at this visitor's location.
  let candidates = (data ?? []).filter(
    (c) => (c.max_impressions == null || c.impressions_served < c.max_impressions) && matchesGeo(c, geo)
  );
  const effWeight = (c: { weight: number; geo_scope: string | null }) => c.weight * (isLocal(c) ? LOCAL_BOOST : 1);

  // Weighted pick; if another request takes the last impression first,
  // the database refuses the claim and we pick again from what is left.
  for (let attempt = 0; attempt < 3 && candidates.length > 0; attempt++) {
    const totalWeight = candidates.reduce((sum, c) => sum + effWeight(c), 0);
    let roll = Math.random() * totalWeight;
    let chosen = candidates[0];
    for (const c of candidates) {
      roll -= effWeight(c);
      if (roll <= 0) {
        chosen = c;
        break;
      }
    }

    let granted = true;
    if (!bot) {
      const { data: claimed } = await supabase.rpc("claim_ad_impression", { p_ad_id: chosen.id });
      granted = claimed === true;
      if (granted) {
        const { data: userData } = await supabase.auth.getUser();
        await supabase.from("ad_events").insert({
          ad_id: chosen.id,
          event_type: "impression",
          user_id: userData.user?.id ?? null,
          session_id: sidFromCookieHeader(req.headers.get("cookie")),
          path: pathFromReferer(req.headers.get("referer")),
          device: deviceFromUa(ua),
          country: req.headers.get("x-vercel-ip-country"),
          region: geo.country === "US" ? geo.region : null,
        });
      }
    }

    if (granted) {
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
    candidates = candidates.filter((c) => c.id !== chosen.id);
  }

  return NextResponse.json({ ad: null });
}
