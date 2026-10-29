import { notFound } from "next/navigation";
import ElectionBrandFrame from "@/components/ElectionBrandFrame";
import LinkVote from "@/components/LinkVote";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID, requireElectionAccess, type ElectionRow } from "@/lib/schoolElection";

export const dynamic = "force-dynamic";

// Public vote-by-link page. Students enter their own code and name; no account needed.
export default async function VoteLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { data } = await createAdminClient().from("school_elections").select("*").eq("id", id).maybeSingle();
  const election = data as ElectionRow | null;
  if (!election) notFound();
  // Vote by link is off: only the organizer's team gets to see the page (as a preview).
  let previewOnly = false;
  if (!election.link_voting) {
    const access = await requireElectionAccess(id);
    if ("error" in access) notFound();
    previewOnly = true;
  }
  return (
    <ElectionBrandFrame id={id}>
      <div className="mx-auto max-w-xl px-5 py-8">
        {previewOnly && (
          <p className="mb-4 rounded-lg border p-3 text-sm font-semibold" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            Preview: this is the page students see, but vote by link is turned off, so no one can vote here yet.
          </p>
        )}
        <LinkVote id={id} title={election.title} school={election.school_name} />
      </div>
    </ElectionBrandFrame>
  );
}
