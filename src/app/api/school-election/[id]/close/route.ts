import { NextResponse } from "next/server";
import { requireElectionAccess } from "@/lib/schoolElection";

// Close voting now. Results become visible once it is closed.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionAccess(id);
  if ("error" in owner) return owner.error;
  if (owner.election.status !== "live") return NextResponse.json({ error: "Only a live election can be closed." }, { status: 400 });
  const { error } = await owner.admin.rpc("close_school_election", { p_election_id: id });
  if (error) return NextResponse.json({ error: "Couldn't close the election." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
