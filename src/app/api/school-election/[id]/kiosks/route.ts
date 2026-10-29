import { NextRequest, NextResponse } from "next/server";
import { newKioskToken, requireElectionAccess } from "@/lib/schoolElection";

// Pair an iPad. The link is shown once; open it on the iPad to turn that iPad into a kiosk.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionAccess(id);
  if ("error" in owner) return owner.error;
  const { admin, election } = owner;
  if (election.status === "closed") return NextResponse.json({ error: "This election is closed." }, { status: 400 });

  const { count } = await admin.from("election_kiosks").select("id", { count: "exact", head: true }).eq("election_id", id);
  if ((count ?? 0) >= election.kiosks) {
    return NextResponse.json({ error: `This election includes ${election.kiosks} kiosk${election.kiosks === 1 ? "" : "s"}. Remove one to pair a new iPad.` }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim().slice(0, 40) : `Kiosk ${(count ?? 0) + 1}`;
  const { token, hash } = newKioskToken();
  const { error } = await admin.from("election_kiosks").insert({ election_id: id, label, token_hash: hash });
  if (error) return NextResponse.json({ error: "Couldn't pair the kiosk." }, { status: 500 });
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  return NextResponse.json({ label, url: `${origin}/kiosk/${token}` });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionAccess(id);
  if ("error" in owner) return owner.error;
  const kioskId = new URL(req.url).searchParams.get("kioskId");
  if (!kioskId) return NextResponse.json({ error: "Missing kioskId" }, { status: 400 });
  const { error } = await owner.admin.from("election_kiosks").delete().eq("id", kioskId).eq("election_id", id);
  if (error) return NextResponse.json({ error: "Couldn't remove that kiosk. Please try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
