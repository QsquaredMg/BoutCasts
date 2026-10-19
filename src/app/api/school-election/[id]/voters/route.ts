import { NextResponse } from "next/server";
import { requireElectionOwner } from "@/lib/schoolElection";

// Roster with codes, for the booth desk and the printable list. Shows who voted, never how.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionOwner(id);
  if ("error" in owner) return owner.error;
  const { data, error } = await owner.admin
    .from("election_voters")
    .select("id, name, student_ref, code, voted_at")
    .eq("election_id", id)
    .order("name", { ascending: true })
    .limit(5000);
  if (error) return NextResponse.json({ error: "Couldn't load the roster." }, { status: 500 });
  return NextResponse.json({ voters: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
