import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, verifyPin } from "@/lib/schoolElection";

// Teacher PIN on the kiosk: clears a lockout, or confirms the teacher before leaving kiosk mode.
// Wrong PINs are counted in the audit log; 5 in 10 minutes blocks further tries for a while.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { token, pin, action } = body ?? {};
  if (typeof token !== "string" || typeof pin !== "string" || !/^\d{6}$/.test(pin) || (action !== "unlock" && action !== "exit")) {
    return NextResponse.json({ ok: false, error: "bad_pin" }, { status: 400 });
  }
  const admin = createAdminClient();
  const hash = hashToken(token);
  const { data: kiosk } = await admin.from("election_kiosks").select("id, election_id").eq("token_hash", hash).maybeSingle();
  if (!kiosk) return NextResponse.json({ ok: false, error: "kiosk_unknown" }, { status: 404 });

  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("election_audit")
    .select("id", { count: "exact", head: true })
    .eq("kiosk_id", kiosk.id)
    .eq("kind", "bad_pin")
    .gte("created_at", since);
  if ((count ?? 0) >= 5) return NextResponse.json({ ok: false, error: "wait" }, { status: 429 });

  const { data: el } = await admin.from("school_elections").select("exit_pin_hash").eq("id", kiosk.election_id).maybeSingle();
  if (!el || !verifyPin(pin, el.exit_pin_hash)) {
    await admin.from("election_audit").insert({ election_id: kiosk.election_id, kiosk_id: kiosk.id, kind: "bad_pin" });
    return NextResponse.json({ ok: false, error: "bad_pin" }, { status: 401 });
  }
  if (action === "unlock") await admin.rpc("kiosk_unlock", { p_token_hash: hash });
  return NextResponse.json({ ok: true });
}
