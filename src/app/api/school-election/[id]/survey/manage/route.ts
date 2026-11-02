import { NextResponse } from "next/server";
import { requireElectionAccess, UUID } from "@/lib/schoolElection";
import { MAX_CUSTOM_QUESTIONS, starterQuestions, type SurveyQuestion } from "@/lib/surveyBank";

// Teacher controls for the voter survey: set it up from a starter bank, add up to three of your own questions,
// open and close it, and hide any open answer that names someone or isn't appropriate.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionAccess(id);
  if ("error" in owner) return owner.error;
  const { admin, election } = owner;
  const [{ data: survey }, { count }, { data: el }] = await Promise.all([
    admin.from("election_surveys").select("status, questions").eq("election_id", id).maybeSingle(),
    admin.from("election_survey_responses").select("id", { count: "exact", head: true }).eq("election_id", id),
    admin.from("school_elections").select("grade_level, election_class_label, voting_group_label").eq("id", id).maybeSingle(),
  ]);
  const openQ = ((survey?.questions ?? []) as SurveyQuestion[]).filter((q) => q.type === "open").map((q) => q.id);
  const { data: rows } = survey && openQ.length ? await admin.from("election_survey_responses").select("id, answers, open_hidden, created_at").eq("election_id", id).order("created_at", { ascending: false }).limit(300) : { data: [] as { id: string; answers: Record<string, unknown>; open_hidden: boolean; created_at: string }[] };
  const openAnswers = (rows ?? []).flatMap((r) => openQ.map((qid) => ({ id: r.id, question: qid, text: typeof r.answers?.[qid] === "string" ? (r.answers[qid] as string) : "", hidden: r.open_hidden })).filter((a) => a.text));
  return NextResponse.json(
    { status: survey?.status ?? null, questions: survey?.questions ?? [], count: count ?? 0, level: el?.grade_level ?? null, electionClass: el?.election_class_label ?? "", votingGroup: el?.voting_group_label ?? "", openAnswers, electionStatus: election.status },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionAccess(id);
  if ("error" in owner) return owner.error;
  const { admin } = owner;
  const body = await req.json().catch(() => null);
  const now = new Date().toISOString();

  if (body?.action === "labels") {
    const clean = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 80) || null : null);
    const { error } = await admin.from("school_elections").update({ election_class_label: clean(body.electionClass), voting_group_label: clean(body.votingGroup) }).eq("id", id);
    if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body?.action === "setup") {
    if (body.level !== "middle" && body.level !== "high") return NextResponse.json({ error: "Pick middle school or high school." }, { status: 400 });
    const { count } = await admin.from("election_survey_responses").select("id", { count: "exact", head: true }).eq("election_id", id);
    if ((count ?? 0) > 0) return NextResponse.json({ error: "Answers are already in. You can't change the questions now." }, { status: 400 });
    await admin.from("school_elections").update({ grade_level: body.level }).eq("id", id);
    const { error } = await admin.from("election_surveys").upsert({ election_id: id, status: "draft", questions: starterQuestions(body.level), updated_at: now }, { onConflict: "election_id" });
    if (error) return NextResponse.json({ error: "Couldn't set up the survey." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { data: survey } = await admin.from("election_surveys").select("status, questions").eq("election_id", id).maybeSingle();
  if (!survey) return NextResponse.json({ error: "Set up the survey first." }, { status: 400 });

  if (body?.action === "custom") {
    const { count } = await admin.from("election_survey_responses").select("id", { count: "exact", head: true }).eq("election_id", id);
    if ((count ?? 0) > 0) return NextResponse.json({ error: "Answers are already in. You can't change the questions now." }, { status: 400 });
    const list = (Array.isArray(body.questions) ? body.questions : []).slice(0, MAX_CUSTOM_QUESTIONS);
    const customs: SurveyQuestion[] = list
      .map((q: { type?: unknown; text?: unknown }, i: number) => ({ id: `c${i + 1}`, type: q?.type === "open" ? "open" : "rating", text: typeof q?.text === "string" ? q.text.trim().slice(0, 200) : "" }))
      .filter((q: { text: string }) => q.text.length >= 8) as SurveyQuestion[];
    const base = (survey.questions as SurveyQuestion[]).filter((q) => !q.id.startsWith("c"));
    const { error } = await admin.from("election_surveys").update({ questions: [...base, ...customs], updated_at: now }).eq("election_id", id);
    if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body?.action === "status") {
    const to = body.status;
    const ok = (survey.status === "draft" && to === "open") || (survey.status === "open" && (to === "closed" || to === "draft")) || (survey.status === "closed" && to === "open");
    if (!ok) return NextResponse.json({ error: "That change isn't allowed." }, { status: 400 });
    const { error } = await admin.from("election_surveys").update({ status: to, updated_at: now }).eq("election_id", id);
    if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

// Hide (or show again) a response's open answer. Hidden answers never reach the candidates.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionAccess(id);
  if ("error" in owner) return owner.error;
  const body = await req.json().catch(() => null);
  if (typeof body?.responseId !== "string" || !UUID.test(body.responseId) || typeof body?.hidden !== "boolean") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { error } = await owner.admin.from("election_survey_responses").update({ open_hidden: body.hidden }).eq("id", body.responseId).eq("election_id", id);
  if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
