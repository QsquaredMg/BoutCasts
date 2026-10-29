import { NextResponse } from "next/server";
import { requireElectionAccess } from "@/lib/schoolElection";

// The sign-off step of a real election: after voting closes, an adult reviews the turnout and the audit
// trail and certifies the result. A certified election shows an official stamp on the winners graphic.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionAccess(id);
  if ("error" in owner) return owner.error;
  const { election, admin, user } = owner;
  if (election.is_practice) return NextResponse.json({ error: "Practice elections aren't certified." }, { status: 400 });
  if (election.status !== "closed") return NextResponse.json({ error: "Close voting before certifying." }, { status: 400 });
  if (election.certified_at) return NextResponse.json({ error: "Already certified." }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 300) || null : null;
  const { error } = await admin
    .from("school_elections")
    .update({ certified_at: new Date().toISOString(), certified_by: user.id, certified_note: note })
    .eq("id", id)
    .eq("status", "closed")
    .is("certified_at", null);
  if (error) return NextResponse.json({ error: "Couldn't certify the election." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
