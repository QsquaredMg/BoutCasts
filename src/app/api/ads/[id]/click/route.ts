import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deviceFromUa, isBot, pathFromReferer, sidFromCookieHeader } from "@/lib/analytics/ua";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const ua = req.headers.get("user-agent");
  if (isBot(ua)) return NextResponse.json({ ok: true });

  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("ad_events").insert({
    ad_id: id,
    event_type: "click",
    user_id: userData.user?.id ?? null,
    session_id: sidFromCookieHeader(req.headers.get("cookie")),
    path: pathFromReferer(req.headers.get("referer")),
    device: deviceFromUa(ua),
    country: req.headers.get("x-vercel-ip-country"),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
