import ElectionBrandFrame from "@/components/ElectionBrandFrame";
import BoothDesk from "@/components/BoothDesk";

export default async function BoothDeskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ElectionBrandFrame id={id}>
      <div className="mx-auto max-w-2xl px-5 py-6">
        <BoothDesk id={id} />
      </div>
    </ElectionBrandFrame>
  );
}
