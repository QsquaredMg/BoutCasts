import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, logRoleEvent, schoolRolesActive, UUID } from "@/lib/schoolElection";
import { roleByKey } from "@/lib/electionRoles";

// A student enters their role code and gets their role screen. No login; the code is the seat.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase().slice(0, 20) : "";
  if (!code) return NextResponse.json({ error: "Enter your role code." }, { status: 400 });

  const admin = createAdminClient();
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: bad } = await admin.from("election_role_events").select("id", { count: "exact", head: true }).eq("election_id", id).eq("action", "bad_code").gte("created_at", since);
  if ((bad ?? 0) >= 20) return NextResponse.json({ error: "Too many wrong codes. Ask your teacher for help, then try again in a few minutes." }, { status: 429 });

  const { data: seat } = await admin.from("election_staff").select("id, label, role").eq("election_id", id).eq("code_hash", hashToken(code)).is("revoked_at", null).maybeSingle();
  if (!seat) {
    await logRoleEvent(admin, { electionId: id, action: "bad_code" });
    return NextResponse.json({ error: "That code isn't valid." }, { status: 401 });
  }
  const def = roleByKey(seat.role);
  if (!def) return NextResponse.json({ error: "That code isn't valid." }, { status: 401 });

  if (!def.free) {
    const { data: el } = await admin.from("school_elections").select("organizer_id").eq("id", id).maybeSingle();
    if (!(await schoolRolesActive(admin, el?.organizer_id))) {
      return NextResponse.json({ error: "Your school's Student Roles plan isn't active. Ask your teacher." }, { status: 402 });
    }
  }
  await logRoleEvent(admin, { electionId: id, staffId: seat.id, role: seat.role, action: "sign_in", label: seat.label });
  return NextResponse.json({ label: seat.label, role: def.key });
}
