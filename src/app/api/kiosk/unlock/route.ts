import { NextRequest, NextResponse } from "next/server";
import { checkKioskPin } from "@/lib/schoolElection";

// Teacher PIN on the kiosk: clears a lockout, or confirms the teacher before leaving kiosk mode.
// Wrong PINs are counted in the audit log; 5 in 10 minutes blocks further tries for a while.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { token, pin, action } = body ?? {};
  if (typeof token !== "string" || typeof pin !== "string" || !/^\d{6}$/.test(pin) || (action !== "unlock" && action !== "exit")) {
    return NextResponse.json({ ok: false, error: "bad_pin" }, { status: 400 });
  }
  const r = await checkKioskPin(token, pin);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  if (action === "unlock") await r.admin.rpc("kiosk_unlock", { p_token_hash: r.hash });
  return NextResponse.json({ ok: true });
}
