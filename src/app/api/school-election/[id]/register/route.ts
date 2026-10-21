import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID } from "@/lib/schoolElection";

// A student registers to vote by typing their name before the deadline. The answer is the same whether or not the
// name is on the roster, so the page can't be used to learn who is enrolled. Teachers confirm at the booth desk.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 120) return NextResponse.json({ error: "Type your first and last name." }, { status: 400 });
  const { data, error } = await createAdminClient().rpc("register_election_voter", { p_election_id: id, p_name: name });
  if (error) return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  if (!data?.ok) {
    const msg = data?.error === "deadline_passed" ? "The registration deadline has passed. See a teacher." : data?.error === "closed" ? "This election has closed." : "Registration isn't open for this election.";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
