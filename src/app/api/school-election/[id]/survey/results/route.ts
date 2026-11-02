import { NextResponse } from "next/server";
import { requireDeskAccess } from "@/lib/schoolElection";
import type { SurveyQuestion } from "@/lib/surveyBank";

const MIN_GROUP = 5;
const READERS = ["candidate", "campaign_manager", "press", "registrar", "commission_chair", "commission_secretary", "commission_member"];

// Survey results. Every candidate sees the same results at the same moment: when the teacher closes the survey.
// The teacher can look at any time. A grade breakdown shows only when that grade has at least 5 responses.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireDeskAccess(req, id, READERS);
  if ("error" in who) return who.error;
  const { data: survey } = await who.admin.from("election_surveys").select("status, questions").eq("election_id", id).maybeSingle();
  if (!survey) return NextResponse.json({ ready: false, reason: "no_survey" });
  if (who.role !== "owner" && survey.status !== "closed") return NextResponse.json({ ready: false, reason: "not_closed" });

  const { data: rows } = await who.admin.from("election_survey_responses").select("grade, answers, open_hidden").eq("election_id", id).limit(5000);
  const responses = rows ?? [];
  const questions = survey.questions as SurveyQuestion[];

  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);
  const grades = [...new Set(responses.map((r) => r.grade).filter((g): g is string => !!g))].sort();

  const results = questions.map((q) => {
    if (q.type === "rating") {
      const vals = responses.map((r) => r.answers?.[q.id]).filter((v): v is number => typeof v === "number");
      const byGrade = grades
        .map((g) => ({ grade: g, vals: responses.filter((r) => r.grade === g).map((r) => r.answers?.[q.id]).filter((v): v is number => typeof v === "number") }))
        .filter((g) => g.vals.length >= MIN_GROUP)
        .map((g) => ({ grade: g.grade, n: g.vals.length, avg: avg(g.vals) }));
      return { id: q.id, type: q.type, text: q.text, n: vals.length, avg: avg(vals), byGrade };
    }
    if (q.type === "top3") {
      const counts = new Map<string, number>();
      let n = 0;
      for (const r of responses) {
        const picks = r.answers?.[q.id];
        if (Array.isArray(picks)) { n++; for (const p of picks) counts.set(p, (counts.get(p) ?? 0) + 1); }
      }
      return { id: q.id, type: q.type, text: q.text, n, ranked: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([option, count]) => ({ option, count })) };
    }
    const texts = responses.filter((r) => !r.open_hidden).map((r) => r.answers?.[q.id]).filter((v): v is string => typeof v === "string");
    return { id: q.id, type: q.type, text: q.text, n: texts.length, answers: texts.slice(0, 200) };
  });
  return NextResponse.json({ ready: true, total: responses.length, status: survey.status, results }, { headers: { "Cache-Control": "no-store" } });
}
