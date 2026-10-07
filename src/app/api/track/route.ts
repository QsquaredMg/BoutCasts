import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SID_RE, deviceFromUa, isBot } from "@/lib/analytics/ua";

// Records one page view. Called by <AnalyticsTracker/>. Crawlers are dropped,
// we keep only a random session id, a coarse device class and the country the
// host reports - never an IP address.
export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent");
  if (isBot(ua)) return new NextResponse(null, { status: 204 });

  let body: {
    sid?: string; path?: string; ref?: string | null;
    utm_source?: string | null; utm_medium?: string | null; utm_campaign?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!body.sid || !SID_RE.test(body.sid) || !body.path || !body.path.startsWith("/")) {
    return new NextResponse(null, { status: 400 });
  }

  const supabase = await createClient();
  await supabase.rpc("track_pageview", {
    p_session: body.sid,
    p_path: body.path,
    p_referrer_host: body.ref ?? null,
    p_device: deviceFromUa(ua),
    p_country: req.headers.get("x-vercel-ip-country"),
    p_utm_source: body.utm_source ?? null,
    p_utm_medium: body.utm_medium ?? null,
    p_utm_campaign: body.utm_campaign ?? null,
  });
  return new NextResponse(null, { status: 204 });
}
