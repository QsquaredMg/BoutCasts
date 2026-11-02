import ElectionBrandFrame from "@/components/ElectionBrandFrame";
import SurveyForm from "@/components/SurveyForm";

export const metadata = { title: "Student survey" };

// Anonymous survey for the voting group. ?kiosk=1 resets after each answer; ?paper=1 is the teacher's paper-entry mode.
export default async function SurveyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kiosk?: string; paper?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const mode = sp.paper === "1" ? "paper" : sp.kiosk === "1" ? "kiosk" : "link";
  return (
    <ElectionBrandFrame id={id}>
      <div className="mx-auto max-w-2xl px-5 py-6">
        <SurveyForm id={id} mode={mode} />
      </div>
    </ElectionBrandFrame>
  );
}
