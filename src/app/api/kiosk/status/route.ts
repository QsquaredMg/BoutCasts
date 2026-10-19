import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/schoolElection";

// What the kiosk shows before anyone checks in: election name, school and whether voting is open.
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token || token.length > 100) return NextResponse.json({ ok: false }, { status: 404 });
  const admin = createAdminClient();
  const { data: kiosk } = await admin.from("election_kiosks").select("label, election_id, locked_until").eq("token_hash", hashToken(token)).maybeSingle();
  if (!kiosk) return NextResponse.json({ ok: false }, { status: 404 });
  const { data: el } = await admin.from("school_elections").select("title, school_name, status, closes_at").eq("id", kiosk.election_id).maybeSingle();
  if (!el) return NextResponse.json({ ok: false }, { status: 404 });
  const open = el.status === "live" && !!el.closes_at && new Date(el.closes_at) > new Date();
  return NextResponse.json(
    {
      ok: true,
      label: kiosk.label,
      title: el.title,
      school: el.school_name,
      state: open ? "open" : el.status === "draft" ? "not_started" : "closed",
      locked: !!kiosk.locked_until && new Date(kiosk.locked_until) > new Date(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
