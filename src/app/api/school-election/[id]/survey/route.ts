import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID, requireElectionAccess } from "@/lib/schoolElection";
import { cleanAnswers, GRADES, type GradeLevel, type SurveyQuestion } from "@/lib/surveyBank";

const MAX_RESPONSES = 5000;

// Public: the open survey for this election's voting group. No names or IDs are asked.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const admin = createAdminClient();
  const [{ data: survey }, { data: el }] = await Promise.all([
    admin.from("election_surveys").select("status, questions").eq("election_id", id).maybeSingle(),
    admin.from("school_elections").select("grade_level, voting_group_label").eq("id", id).maybeSingle(),
  ]);
  if (!survey || survey.status !== "open") return NextResponse.json({ open: false }, { headers: { "Cache-Control": "no-store" } });
  const level = (el?.grade_level ?? "middle") as GradeLevel;
  return NextResponse.json({ open: true, questions: survey.questions, grades: GRADES[level] ?? GRADES.middle, group: el?.voting_group_label ?? null }, { headers: { "Cache-Control": "no-store" } });
}

// Public: submit one anonymous response. A teacher can also enter paper responses (source "paper") while signed in.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const source = body?.source === "paper" ? "paper" : body?.source === "kiosk" ? "kiosk" : "link";
  const admin = createAdminClient();

  if (source === "paper") {
    const owner = await requireElectionAccess(id);
    if ("error" in owner) return owner.error;
  }
  const { data: survey } = await admin.from("election_surveys").select("status, questions").eq("election_id", id).maybeSingle();
  if (!survey || (survey.status !== "open" && !(source === "paper" && survey?.status === "draft"))) return NextResponse.json({ error: "This survey isn't open." }, { status: 400 });

  const checked = cleanAnswers(survey.questions as SurveyQuestion[], body?.answers);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const { data: el } = await admin.from("school_elections").select("grade_level").eq("id", id).maybeSingle();
  const grades = GRADES[(el?.grade_level ?? "middle") as GradeLevel] ?? GRADES.middle;
  const grade = typeof body?.grade === "string" && grades.includes(body.grade) ? body.grade : null;

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const ipHash = ip ? createHash("sha256").update(`survey:${id}:${ip}`).digest("hex").slice(0, 32) : null;
  if (source !== "paper") {
    // A whole class shares one school network, so the limit is generous; it only stops scripts.
    if (ipHash) {
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count: recent } = await admin.from("election_survey_responses").select("id", { count: "exact", head: true }).eq("election_id", id).eq("ip_hash", ipHash).gte("created_at", since);
      if ((recent ?? 0) >= 300) return NextResponse.json({ error: "Too many answers from this network right now. Try again in a few minutes." }, { status: 429 });
    }
  }
  const { count: total } = await admin.from("election_survey_responses").select("id", { count: "exact", head: true }).eq("election_id", id);
  if ((total ?? 0) >= MAX_RESPONSES) return NextResponse.json({ error: "This survey is full." }, { status: 400 });

  const { error } = await admin.from("election_survey_responses").insert({ election_id: id, source, grade, answers: checked.answers, ip_hash: source === "paper" ? null : ipHash });
  if (error) return NextResponse.json({ error: "Couldn't save your answers. Please try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
