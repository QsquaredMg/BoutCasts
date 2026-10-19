import { NextRequest, NextResponse } from "next/server";
import { newStaffCode, requireElectionOwner } from "@/lib/schoolElection";

// Optional staff seats: codes that open the booth desk for a teacher without the organizer's login.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionOwner(id);
  if ("error" in owner) return owner.error;
  const { data } = await owner.admin.from("election_staff").select("id, label, created_at").eq("election_id", id).is("revoked_at", null).order("created_at");
  return NextResponse.json({ staff: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionOwner(id);
  if ("error" in owner) return owner.error;
  const body = await req.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim().slice(0, 60) : "";
  if (!label) return NextResponse.json({ error: "Give the seat a name, like the teacher's name." }, { status: 400 });
  const { count } = await owner.admin.from("election_staff").select("id", { count: "exact", head: true }).eq("election_id", id).is("revoked_at", null);
  if ((count ?? 0) >= 10) return NextResponse.json({ error: "Up to 10 staff seats per election." }, { status: 400 });
  const { code, hash } = newStaffCode();
  const { error } = await owner.admin.from("election_staff").insert({ election_id: id, label, code_hash: hash });
  if (error) return NextResponse.json({ error: "Couldn't create the seat." }, { status: 500 });
  return NextResponse.json({ label, code });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionOwner(id);
  if ("error" in owner) return owner.error;
  const staffId = new URL(req.url).searchParams.get("staffId") ?? "";
  await owner.admin.from("election_staff").update({ revoked_at: new Date().toISOString() }).eq("id", staffId).eq("election_id", id);
  return NextResponse.json({ ok: true });
}
