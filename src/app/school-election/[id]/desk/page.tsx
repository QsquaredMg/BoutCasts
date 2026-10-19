import BoothDesk from "@/components/BoothDesk";

export default async function BoothDeskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-2xl px-5 py-6">
      <BoothDesk id={id} />
    </div>
  );
}
