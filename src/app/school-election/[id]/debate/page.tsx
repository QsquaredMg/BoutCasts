import ElectionBrandFrame from "@/components/ElectionBrandFrame";
import DebateTimer from "@/components/DebateTimer";

export default async function DebatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ElectionBrandFrame id={id}>
      <div className="mx-auto max-w-2xl px-5 py-6">
        <DebateTimer id={id} />
      </div>
    </ElectionBrandFrame>
  );
}
