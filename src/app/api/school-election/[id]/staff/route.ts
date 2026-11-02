import { NextRequest, NextResponse } from "next/server";
import { logRoleEvent, newStaffCode, requireElectionAccess, normName, schoolRolesActive, STAFF_ROLES, UUID } from "@/lib/schoolElection";
import { CANDIDATE_ROLE_KEYS, FREE_ROLE_KEYS, STUDENT_ROLES_PLAN } from "@/lib/electionRoles";

// Staff and student-role seats: a code per person that opens their role's screen without the organizer's login.
// The three booth roles (check-in, judge, observer) are free. The student roles need the Student Roles plan.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionAccess(id);
  if ("error" in owner) return owner.error;
  const { data } = await owner.admin.from("election_staff").select("id, label, role, option_id, created_at").eq("election_id", id).is("revoked_at", null).order("created_at");
  const premium = await schoolRolesActive(owner.admin, owner.election.organizer_id);
  return NextResponse.json({ staff: data ?? [], premium, price_cents: STUDENT_ROLES_PLAN.priceCents }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionAccess(id);
  if ("error" in owner) return owner.error;
  const body = await req.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim().slice(0, 60) : "";
  const role = STAFF_ROLES.includes(body?.role) ? (body.role as string) : "check_in";
  if (!label) return NextResponse.json({ error: "Give the seat a name, like the student's name." }, { status: 400 });

  const optionId = typeof body?.optionId === "string" && UUID.test(body.optionId) ? (body.optionId as string) : null;
  if (CANDIDATE_ROLE_KEYS.includes(role)) {
    // A candidate or campaign manager works on exactly one candidate in this election.
    const { data: races } = await owner.admin.from("live_vote_events").select("id").eq("election_id", id);
    const { data: option } = optionId ? await owner.admin.from("live_vote_options").select("id, event_id").eq("id", optionId).maybeSingle() : { data: null };
    if (!option || !(races ?? []).some((r) => r.id === option.event_id)) return NextResponse.json({ error: "Pick the candidate this seat works on." }, { status: 400 });
  }

  // The class that runs the election and the class that votes are different groups.
  const { count: onRoster } = await owner.admin.from("election_voters").select("id", { count: "exact", head: true }).eq("election_id", id).eq("name_norm", normName(label));
  if ((onRoster ?? 0) > 0) {
    return NextResponse.json({ error: `${label} is on the voting roster. A student can run the election or vote in it, not both. If this is a different student, add a middle initial.` }, { status: 409 });
  }

  const premium = await schoolRolesActive(owner.admin, owner.election.organizer_id);
  if (!premium && !FREE_ROLE_KEYS.includes(role)) {
    return NextResponse.json({ error: "Student roles need the Student Roles plan." }, { status: 402 });
  }
  const cap = premium ? STUDENT_ROLES_PLAN.seatCap : STUDENT_ROLES_PLAN.freeSeatCap;
  const { count } = await owner.admin.from("election_staff").select("id", { count: "exact", head: true }).eq("election_id", id).is("revoked_at", null);
  if ((count ?? 0) >= cap) return NextResponse.json({ error: `Up to ${cap} seats per election.` }, { status: 400 });

  const { code, hash } = newStaffCode();
  const { data: seat, error } = await owner.admin.from("election_staff").insert({ election_id: id, label, role, code_hash: hash, option_id: CANDIDATE_ROLE_KEYS.includes(role) ? optionId : null }).select("id").single();
  if (error || !seat) return NextResponse.json({ error: "Couldn't create the seat." }, { status: 500 });
  await logRoleEvent(owner.admin, { electionId: id, staffId: seat.id, role, action: "seat_created", label });
  return NextResponse.json({ label, role, code });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionAccess(id);
  if ("error" in owner) return owner.error;
  const staffId = new URL(req.url).searchParams.get("staffId") ?? "";
  const { data: seat } = await owner.admin.from("election_staff").select("role, label").eq("id", staffId).eq("election_id", id).maybeSingle();
  const { error } = await owner.admin.from("election_staff").update({ revoked_at: new Date().toISOString() }).eq("id", staffId).eq("election_id", id);
  if (error) return NextResponse.json({ error: "Couldn't remove that seat. Please try again." }, { status: 500 });
  if (seat) await logRoleEvent(owner.admin, { electionId: id, staffId, role: seat.role, action: "seat_revoked", label: seat.label });
  return NextResponse.json({ ok: true });
}
