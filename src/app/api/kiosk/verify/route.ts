import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addClipUrls, hashToken } from "@/lib/schoolElection";

// Kiosk step 1: does this code + name match a student who has not voted? Returns the ballot if so.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { token, code, name } = body ?? {};
  if (typeof token !== "string" || typeof code !== "string" || typeof name !== "string" || token.length > 100 || code.length > 20 || name.length > 160) {
    return NextResponse.json({ ok: false, error: "no_match" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("kiosk_verify", { p_token_hash: hashToken(token), p_code: code, p_name: name });
  if (error) {
    console.error("kiosk/verify", error);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
  if (data?.ok) data.ballot = await addClipUrls(admin, data.ballot);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
