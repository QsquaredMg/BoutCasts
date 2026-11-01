import ElectionBrandFrame from "@/components/ElectionBrandFrame";
import RoleStation from "@/components/RoleStation";

export const metadata = { title: "Your election role" };

export default async function RolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ElectionBrandFrame id={id}>
      <div className="mx-auto max-w-2xl px-5 py-6">
        <RoleStation id={id} />
      </div>
    </ElectionBrandFrame>
  );
}
