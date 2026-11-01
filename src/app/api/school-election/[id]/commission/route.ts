import { NextResponse } from "next/server";
import { requireDeskAccess, UUID } from "@/lib/schoolElection";

const COMMISSION = ["commission_chair", "commission_secretary", "commission_member"];
const TOPICS = ["eligibility", "calendar", "dispute", "other"];
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// The Commission advises; the Supervisor decides. Advice and minutes are listed with the Supervisor's decision beside them.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireDeskAccess(req, id, COMMISSION);
  if ("error" in who) return who.error;
  const { data } = await who.admin
    .from("election_commission_items")
    .select("id, author_label, kind, topic, subject, body, option_id, decision, decided_at, created_at")
    .eq("election_id", id)
    .order("created_at", { ascending: false })
    .limit(200);
  // Candidates for the "about" dropdown. Names only.
  const { data: races } = await who.admin.from("live_vote_events").select("id, title").eq("election_id", id).order("election_sort");
  const raceIds = (races ?? []).map((r) => r.id);
  const { data: options } = raceIds.length ? await who.admin.from("live_vote_options").select("id, event_id, name").in("event_id", raceIds) : { data: [] as { id: string; event_id: string; name: string }[] };
  const candidates = (options ?? []).map((o) => ({ id: o.id, name: o.name, office: (races ?? []).find((r) => r.id === o.event_id)?.title ?? "" }));
  return NextResponse.json({ items: data ?? [], candidates, role: who.role }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireDeskAccess(req, id, COMMISSION);
  if ("error" in who) return who.error;
  if (who.role === "owner") return NextResponse.json({ error: "The Supervisor decides; use the decision box." }, { status: 400 });
  const body = await req.json().catch(() => null);
  const kind = body?.kind === "minutes" ? "minutes" : "advice";
  // Only the secretary (or chair) keeps the minutes.
  if (kind === "minutes" && !["commission_secretary", "commission_chair"].includes(who.role)) return NextResponse.json({ error: "Only the secretary keeps the minutes." }, { status: 403 });
  const subject = clean(body?.subject, 120);
  const text = clean(body?.body, 1500);
  if (!subject || !text) return NextResponse.json({ error: "Add a subject and your notes." }, { status: 400 });
  const topic = TOPICS.includes(body?.topic) ? body.topic : "other";
  const optionId = typeof body?.optionId === "string" && UUID.test(body.optionId) ? body.optionId : null;
  const { error } = await who.admin.from("election_commission_items").insert({ election_id: id, staff_id: who.staffId, author_label: who.label, kind, topic, subject, body: text, option_id: optionId });
  if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Supervisor only: record the final decision next to a piece of advice.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireDeskAccess(req, id, []);
  if ("error" in who) return who.error;
  const body = await req.json().catch(() => null);
  if (typeof body?.itemId !== "string" || !UUID.test(body.itemId)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const decision = clean(body.decision, 400) || null;
  const { error } = await who.admin.from("election_commission_items").update({ decision, decided_at: decision ? new Date().toISOString() : null }).eq("id", body.itemId).eq("election_id", id).eq("kind", "advice");
  if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
