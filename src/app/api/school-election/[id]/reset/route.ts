import { NextResponse } from "next/server";
import { requireElectionOwner } from "@/lib/schoolElection";

// Practice elections only: wipe the votes and run it again.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionOwner(id);
  if ("error" in owner) return owner.error;
  if (!owner.election.is_practice) return NextResponse.json({ error: "Only practice elections can be reset." }, { status: 400 });
  if (owner.election.status === "draft") return NextResponse.json({ error: "Open voting first." }, { status: 400 });
  const { data, error } = await owner.admin.rpc("reset_school_election", { p_election_id: id });
  if (error || !data?.ok) return NextResponse.json({ error: "Couldn't reset the election." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
