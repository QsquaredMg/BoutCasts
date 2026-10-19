import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/schoolElection";

// Kiosk step 2: submit the whole ballot at once. requestId makes a retry after a dropped connection safe:
// the same submission never counts twice.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { token, code, name, choices, requestId, castAt } = body ?? {};
  const castDate = typeof castAt === "string" && !Number.isNaN(Date.parse(castAt)) ? new Date(castAt).toISOString() : null;
  if (
    typeof token !== "string" || typeof code !== "string" || typeof name !== "string" ||
    typeof requestId !== "string" || requestId.length > 80 ||
    !choices || typeof choices !== "object" || Array.isArray(choices)
  ) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  const { data, error } = await createAdminClient().rpc("kiosk_cast_ballot", {
    p_token_hash: hashToken(token),
    p_code: code,
    p_name: name,
    p_choices: choices,
    p_request_id: requestId,
    p_cast_at: castDate,
  });
  if (error) {
    console.error("kiosk/submit", error);
    const full = /cap reached/i.test(error.message);
    return NextResponse.json({ ok: false, error: full ? "cap" : "server" }, { status: 500 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
