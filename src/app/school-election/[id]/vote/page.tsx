import { notFound } from "next/navigation";
import ElectionBrandFrame from "@/components/ElectionBrandFrame";
import LinkVote from "@/components/LinkVote";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID, requireElectionAccess, type ElectionRow } from "@/lib/schoolElection";

export const dynamic = "force-dynamic";

// Public vote-by-link page. Students enter their own code and name; no account needed.
export default async function VoteLinkPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ preview?: string }> }) {
  const { id } = await params;
  const { preview } = await searchParams;
  if (!UUID.test(id)) notFound();
  const { data } = await createAdminClient().from("school_elections").select("*").eq("id", id).maybeSingle();
  const election = data as ElectionRow | null;
  if (!election) notFound();
  // Vote by link is off: only the organizer's team gets to see the page (as a preview).
  // Organizer preview (?preview=1): the real ballot, any code and name works, nothing is saved.
  let previewOnly = false;
  let previewBallot: { race_id: string; title: string; options: { id: string; name: string; description: string | null; image_url: string | null; video_url: string | null }[] }[] | undefined;
  if (preview === "1" || !election.link_voting) {
    const access = await requireElectionAccess(id);
    if ("error" in access) notFound();
    previewOnly = !election.link_voting;
    if (preview === "1") {
      const admin = createAdminClient();
      const { data: races } = await admin.from("live_vote_events").select("id, title").eq("election_id", id).order("election_sort");
      const ids = (races ?? []).map((r) => r.id as string);
      const { data: opts } = ids.length
        ? await admin.from("live_vote_options").select("id, event_id, name, description, image_url, source_url, source_type, sort_order").in("event_id", ids).order("sort_order")
        : { data: [] as { id: string; event_id: string; name: string; description: string | null; image_url: string | null; source_url: string | null; source_type: string | null }[] };
      previewBallot = (races ?? []).map((r) => ({
        race_id: r.id as string,
        title: r.title as string,
        options: (opts ?? []).filter((o) => o.event_id === r.id).map((o) => ({
          id: o.id as string, name: o.name as string, description: (o.description as string | null) ?? null,
          image_url: (o.image_url as string | null) ?? null,
          video_url: o.source_type === "upload" ? ((o.source_url as string | null) ?? null) : null,
        })),
      }));
    }
  }
  return (
    <ElectionBrandFrame id={id}>
      <div className="mx-auto max-w-xl px-5 py-8">
        {previewOnly && (
          <p className="mb-4 rounded-lg border p-3 text-sm font-semibold" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            Preview: this is the page students see. Vote by link is turned off, so no one can vote here yet.
          </p>
        )}
        {previewBallot && (
          <p className="mb-4 rounded-lg border p-3 text-sm font-semibold" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            Preview mode: tap Start voting with anything typed in (or nothing). Votes here are not saved or counted.
          </p>
        )}
        <LinkVote id={id} title={election.title} school={election.school_name} previewBallot={previewBallot} />
      </div>
    </ElectionBrandFrame>
  );
}
