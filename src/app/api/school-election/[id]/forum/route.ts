import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDeskAccess, UUID } from "@/lib/schoolElection";

// Public: submit a question for the debate or forum. Questions wait for a teacher's approval before anyone sees them.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const text = typeof body?.question === "string" ? body.question.trim() : "";
  const asker = typeof body?.asker === "string" ? body.asker.trim() : "";
  if (text.length < 10 || text.length > 200) return NextResponse.json({ error: "Write your question in 10 to 200 characters." }, { status: 400 });
  if (asker.length > 40) return NextResponse.json({ error: "Use a first name or grade, up to 40 characters." }, { status: 400 });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const ipHash = ip ? createHash("sha256").update(`forum:${id}:${ip}`).digest("hex").slice(0, 32) : null;
  const { data, error } = await createAdminClient().rpc("submit_forum_question", { p_election_id: id, p_body: text, p_asker: asker || null, p_ip_hash: ipHash });
  if (error) return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  if (!data?.ok) {
    const msg: Record<string, string> = {
      not_open: "The question box isn't open for this election.",
      closed: "This election has closed.",
      slow_down: "You've sent a few questions already. Wait a few minutes.",
      queue_full: "The question box is full right now. Try again later.",
      invalid: "Check your question and try again.",
    };
    return NextResponse.json({ ok: false, error: msg[data?.error as string] ?? "Couldn't send your question." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

// Moderators (organizer or a judge seat): the full queue, every status.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireDeskAccess(req, id, ["judge"]);
  if ("error" in who) return who.error;
  const { data, error } = await who.admin
    .from("election_forum_questions")
    .select("id, body, asker, status, created_at")
    .eq("election_id", id)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) return NextResponse.json({ error: "Couldn't load questions." }, { status: 500 });
  return NextResponse.json({ questions: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

// Moderators: approve, hide, or mark a question as asked during the debate.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireDeskAccess(req, id, ["judge"]);
  if ("error" in who) return who.error;
  const body = await req.json().catch(() => null);
  if (typeof body?.questionId !== "string" || !UUID.test(body.questionId) || !["pending", "approved", "asked", "hidden"].includes(body?.status)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { error } = await who.admin.from("election_forum_questions").update({ status: body.status }).eq("id", body.questionId).eq("election_id", id);
  if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
