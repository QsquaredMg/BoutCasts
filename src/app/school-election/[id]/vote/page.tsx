import { notFound } from "next/navigation";
import ElectionBrandFrame from "@/components/ElectionBrandFrame";
import LinkVote from "@/components/LinkVote";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID, type ElectionRow } from "@/lib/schoolElection";

export const dynamic = "force-dynamic";

// Public vote-by-link page. Students enter their own code and name; no account needed.
export default async function VoteLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { data } = await createAdminClient().from("school_elections").select("*").eq("id", id).maybeSingle();
  const election = data as ElectionRow | null;
  if (!election || !election.link_voting) notFound();
  return (
    <ElectionBrandFrame id={id}>
      <div className="mx-auto max-w-xl px-5 py-8">
        <LinkVote id={id} title={election.title} school={election.school_name} />
      </div>
    </ElectionBrandFrame>
  );
}
