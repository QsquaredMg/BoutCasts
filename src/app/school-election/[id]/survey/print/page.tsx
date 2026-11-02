import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID } from "@/lib/schoolElection";
import { GRADES, type GradeLevel, type SurveyQuestion } from "@/lib/surveyBank";
import SurveyPrintButton from "@/components/SurveyPrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Printable survey" };

// A paper copy of the survey. Students fill it in anonymously; the teacher enters the answers at ?paper=1.
export default async function PrintSurvey({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const admin = createAdminClient();
  const [{ data: survey }, { data: el }] = await Promise.all([
    admin.from("election_surveys").select("questions").eq("election_id", id).maybeSingle(),
    admin.from("school_elections").select("title, school_name, grade_level").eq("id", id).maybeSingle(),
  ]);
  if (!survey || !el) notFound();
  const qs = survey.questions as SurveyQuestion[];
  const grades = GRADES[(el.grade_level ?? "middle") as GradeLevel];
  return (
    <div className="mx-auto max-w-2xl p-6 text-black print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden"><p className="text-sm">Print this page for classes without devices.</p><SurveyPrintButton /></div>
      <h1 className="text-2xl font-black">{el.school_name ?? "School"} student survey</h1>
      <p className="text-sm">{el.title}. Anonymous: do not write your name. Please don&apos;t name people in your answers.</p>
      <ol className="mt-4 grid gap-4">
        {qs.map((q) => (
          <li key={q.id} className="break-inside-avoid text-sm">
            <p className="font-bold">{q.text}</p>
            {q.type === "rating" && <p className="mt-1">Not important&nbsp; ① &nbsp;② &nbsp;③ &nbsp;④ &nbsp;⑤ &nbsp;Very important</p>}
            {q.type === "top3" && <ul className="mt-1 grid grid-cols-2 gap-x-4">{q.options.map((o) => <li key={o}>☐ {o}</li>)}</ul>}
            {q.type === "open" && <div className="mt-1 h-16 border-b border-black" />}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm font-bold">Your grade: {grades.map((g) => `☐ ${g}`).join("   ")}</p>
    </div>
  );
}
