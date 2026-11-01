import { NextResponse } from "next/server";
import { requireDeskAccess, UUID } from "@/lib/schoolElection";

const READERS = ["qualification_clerk", "commission_chair", "commission_secretary", "commission_member"];
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Every candidate with their filing check. The clerk marks complete or incomplete; the Supervisor decides.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireDeskAccess(req, id, READERS);
  if ("error" in who) return who.error;
  const { data: races } = await who.admin.from("live_vote_events").select("id, title, election_sort").eq("election_id", id).order("election_sort");
  const raceIds = (races ?? []).map((r) => r.id);
  const { data: options } = raceIds.length ? await who.admin.from("live_vote_options").select("id, event_id, name, sort_order").in("event_id", raceIds).order("sort_order") : { data: [] as { id: string; event_id: string; name: string }[] };
  const { data: filings } = await who.admin.from("election_filings").select("option_id, status, note, clerk_label, supervisor_decision").eq("election_id", id);
  const byOption = new Map((filings ?? []).map((f) => [f.option_id, f]));
  return NextResponse.json(
    {
      role: who.role,
      races: (races ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        candidates: (options ?? []).filter((o) => o.event_id === r.id).map((o) => {
          const f = byOption.get(o.id);
          return { id: o.id, name: o.name, status: f?.status ?? "pending", note: f?.note ?? "", clerk: f?.clerk_label ?? null, decision: f?.supervisor_decision ?? null };
        }),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// The clerk marks a filing complete or incomplete, with a short note that cites the written rule.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireDeskAccess(req, id, ["qualification_clerk"]);
  if ("error" in who) return who.error;
  const body = await req.json().catch(() => null);
  if (typeof body?.optionId !== "string" || !UUID.test(body.optionId) || !["pending", "complete", "incomplete"].includes(body?.status)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { data: races } = await who.admin.from("live_vote_events").select("id").eq("election_id", id);
  const { data: option } = await who.admin.from("live_vote_options").select("id, event_id").eq("id", body.optionId).maybeSingle();
  if (!option || !(races ?? []).some((r) => r.id === option.event_id)) return NextResponse.json({ error: "Unknown candidate" }, { status: 404 });
  const { error } = await who.admin.from("election_filings").upsert({ option_id: body.optionId, election_id: id, status: body.status, note: clean(body.note, 300) || null, clerk_label: who.label, updated_at: new Date().toISOString() }, { onConflict: "option_id" });
  if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Supervisor only: approve or decline a candidate after reading the clerk's check and the Commission's advice.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireDeskAccess(req, id, []);
  if ("error" in who) return who.error;
  const body = await req.json().catch(() => null);
  if (typeof body?.optionId !== "string" || !UUID.test(body.optionId)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const decision = body.decision === "approved" || body.decision === "declined" ? body.decision : null;
  const { error } = await who.admin.from("election_filings").upsert({ option_id: body.optionId, election_id: id, supervisor_decision: decision, updated_at: new Date().toISOString() }, { onConflict: "option_id" });
  if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
