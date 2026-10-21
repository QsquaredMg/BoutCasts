import { NextResponse } from "next/server";
import { requireDeskAccess, UUID } from "@/lib/schoolElection";

const KINDS = ["voter_issue", "equipment", "electioneering", "safety", "other"];
const ALL_ROLES = ["check_in", "judge", "observer"] as const;

// Incident log. Every poll worker (and the organizer) can read it and add to it; only a judge or the organizer resolves.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireDeskAccess(req, id, [...ALL_ROLES]);
  if ("error" in who) return who.error;
  const { data, error } = await who.admin
    .from("election_incidents")
    .select("id, reporter_label, kind, note, created_at, resolved_at, resolved_by, resolution")
    .eq("election_id", id)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: "Couldn't load the log." }, { status: 500 });
  return NextResponse.json({ incidents: data ?? [], role: who.role }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireDeskAccess(req, id, [...ALL_ROLES]);
  if ("error" in who) return who.error;
  const body = await req.json().catch(() => null);
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (!note || note.length > 500) return NextResponse.json({ error: "Describe what happened in 500 characters or fewer. Don't use student names." }, { status: 400 });
  const kind = KINDS.includes(body?.kind) ? body.kind : "other";
  const { count } = await who.admin.from("election_incidents").select("id", { count: "exact", head: true }).eq("election_id", id);
  if ((count ?? 0) >= 1000) return NextResponse.json({ error: "The log is full." }, { status: 400 });
  const { error } = await who.admin.from("election_incidents").insert({ election_id: id, staff_id: who.staffId, reporter_label: who.label, kind, note });
  if (error) return NextResponse.json({ error: "Couldn't save the entry." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireDeskAccess(req, id, ["judge"]);
  if ("error" in who) return who.error;
  const body = await req.json().catch(() => null);
  if (typeof body?.incidentId !== "string" || !UUID.test(body.incidentId)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const resolution = typeof body.resolution === "string" ? body.resolution.trim().slice(0, 300) : "";
  if (!resolution) return NextResponse.json({ error: "Say how it was resolved." }, { status: 400 });
  const { error } = await who.admin
    .from("election_incidents")
    .update({ resolved_at: new Date().toISOString(), resolved_by: who.label, resolution })
    .eq("id", body.incidentId)
    .eq("election_id", id)
    .is("resolved_at", null);
  if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
