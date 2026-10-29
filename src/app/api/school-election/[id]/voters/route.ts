import { NextResponse } from "next/server";
import { requireDeskAccess } from "@/lib/schoolElection";

// Roster with codes, for the booth desk and the printable list. Shows who voted, never how.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireDeskAccess(req, id);
  if ("error" in owner) return owner.error;
  const { data, error } = await owner.admin
    .from("election_voters")
    .select("id, name, student_ref, code, voted_at, registered_at, email, emailed_at")
    .eq("election_id", id)
    .order("name", { ascending: true })
    .limit(5000);
  if (error) return NextResponse.json({ error: "Couldn't load the roster." }, { status: 500 });
  const { data: el } = await owner.admin.from("school_elections").select("require_registration").eq("id", id).maybeSingle();
  return NextResponse.json({ voters: data ?? [], requireRegistration: !!el?.require_registration }, { headers: { "Cache-Control": "no-store" } });
}
