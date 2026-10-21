import { NextResponse } from "next/server";
import { requireDeskAccess, UUID } from "@/lib/schoolElection";

// Booth desk: a teacher registers a student. Works after the self-registration deadline too.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireDeskAccess(req, id);
  if ("error" in owner) return owner.error;
  const body = await req.json().catch(() => null);
  if (typeof body?.voterId !== "string" || !UUID.test(body.voterId)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { data, error } = await owner.admin.rpc("desk_register_voter", { p_election_id: id, p_voter_id: body.voterId });
  if (error || !data?.ok) return NextResponse.json({ error: "Couldn't register that student." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
