import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDeskAccess, UUID } from "@/lib/schoolElection";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Student press. Articles stay private until the Supervisor publishes them. Fact-check flags go to the Commission.
// Without a seat code or login, this returns only published articles.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (req.headers.get("x-desk-code") || new URL(req.url).searchParams.get("all") === "1") {
    const who = await requireDeskAccess(req, id, ["press", "commission_chair", "commission_secretary", "commission_member"]);
    if ("error" in who) return who.error;
    // The press sees only their own posts; the Commission and Supervisor see everything.
    let q = who.admin.from("election_press_posts").select("id, author_label, kind, title, body, source_url, option_id, status, created_at").eq("election_id", id).order("created_at", { ascending: false }).limit(200);
    if (who.role === "press" && who.staffId) q = q.eq("staff_id", who.staffId);
    const { data } = await q;
    return NextResponse.json({ posts: data ?? [], role: who.role }, { headers: { "Cache-Control": "no-store" } });
  }
  const { data } = await createAdminClient().from("election_press_posts").select("id, author_label, title, body, source_url, created_at").eq("election_id", id).eq("kind", "article").eq("status", "published").order("created_at", { ascending: false }).limit(50);
  return NextResponse.json({ posts: data ?? [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireDeskAccess(req, id, ["press"]);
  if ("error" in who) return who.error;
  const body = await req.json().catch(() => null);
  const kind = body?.kind === "claim_flag" ? "claim_flag" : "article";
  const title = clean(body?.title, 120);
  const text = clean(body?.body, 2000);
  const source = clean(body?.sourceUrl, 300);
  if (!title || !text) return NextResponse.json({ error: "Add a headline and your text." }, { status: 400 });
  if (kind === "claim_flag" && !source) return NextResponse.json({ error: "A fact-check flag needs a source link." }, { status: 400 });
  if (source && !/^https?:\/\//i.test(source)) return NextResponse.json({ error: "Source links start with http:// or https://" }, { status: 400 });
  const optionId = typeof body?.optionId === "string" && UUID.test(body.optionId) ? body.optionId : null;
  const { error } = await who.admin.from("election_press_posts").insert({ election_id: id, staff_id: who.staffId, author_label: who.label, kind, title, body: text, source_url: source || null, option_id: optionId });
  if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Supervisor only: publish or hide an article.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireDeskAccess(req, id, []);
  if ("error" in who) return who.error;
  const body = await req.json().catch(() => null);
  if (typeof body?.postId !== "string" || !UUID.test(body.postId) || !["pending", "published", "hidden"].includes(body?.status)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { error } = await who.admin.from("election_press_posts").update({ status: body.status }).eq("id", body.postId).eq("election_id", id);
  if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
