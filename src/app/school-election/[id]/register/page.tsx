import { notFound } from "next/navigation";
import ElectionBrandFrame from "@/components/ElectionBrandFrame";
import ElectionRegister from "@/components/ElectionRegister";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID, type ElectionRow } from "@/lib/schoolElection";

export const dynamic = "force-dynamic";

// Public self-registration page. Students type their name; a teacher can confirm it at the booth desk.
export default async function RegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { data } = await createAdminClient().from("school_elections").select("*").eq("id", id).maybeSingle();
  const election = data as ElectionRow | null;
  if (!election || !election.require_registration) notFound();
  return (
    <ElectionBrandFrame id={id}>
      <div className="mx-auto max-w-md px-5 py-8">
        <ElectionRegister id={id} title={election.title} school={election.school_name} deadline={election.registration_closes_at} closed={election.status === "closed"} />
      </div>
    </ElectionBrandFrame>
  );
}
