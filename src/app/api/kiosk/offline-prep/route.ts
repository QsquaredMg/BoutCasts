import { NextRequest, NextResponse } from "next/server";
import { checkKioskPin, voterHash } from "@/lib/schoolElection";

// A teacher (PIN) loads the ballot and a list of check-in fingerprints onto the iPad, so students can still
// check in and vote if the Wi-Fi drops. Fingerprints are salted hashes of code + name for students who have
// not voted yet: the iPad never receives the plain roster or codes.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { token, pin } = body ?? {};
  if (typeof token !== "string" || typeof pin !== "string" || !/^\d{6}$/.test(pin)) {
    return NextResponse.json({ ok: false, error: "bad_pin" }, { status: 400 });
  }
  const r = await checkKioskPin(token, pin);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });

  const { data: el } = await r.admin.from("school_elections").select("id, title, school_name, status, closes_at, require_registration").eq("id", r.electionId).maybeSingle();
  if (!el || el.status !== "live") return NextResponse.json({ ok: false, error: "closed" }, { status: 400 });
  const [{ data: ballot }, { data: voters }] = await Promise.all([
    r.admin.rpc("election_ballot", { p_election_id: r.electionId }),
    (() => {
      const q = r.admin.from("election_voters").select("code, name").eq("election_id", r.electionId).is("voted_at", null);
      // When registration is required, only registered students get a fingerprint for offline check-in.
      return (el.require_registration ? q.not("registered_at", "is", null) : q).limit(50000);
    })(),
  ]);
  return NextResponse.json(
    { ok: true, electionId: r.electionId, ballot, closesAt: el.closes_at, hashes: (voters ?? []).map((v) => voterHash(r.electionId, v.code, v.name)), preparedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
