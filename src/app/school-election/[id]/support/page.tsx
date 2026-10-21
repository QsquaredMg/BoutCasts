import { notFound } from "next/navigation";
import ElectionBrandFrame from "@/components/ElectionBrandFrame";
import ElectionSupport from "@/components/ElectionSupport";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID, isOpen, type ElectionRow } from "@/lib/schoolElection";
import { SUPER_VOTES } from "@/lib/liveVoteEvents/tiers";

export const dynamic = "force-dynamic";

// Public supporter page. It shows the school's total raised and lets an adult give toward a candidate's campaign.
// It deliberately shows no per-candidate amounts and no vote counts.
export default async function SupportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ thanks?: string }> }) {
  const { id } = await params;
  const { thanks } = await searchParams;
  if (!UUID.test(id)) notFound();
  const admin = createAdminClient();
  const { data } = await admin.from("school_elections").select("*").eq("id", id).maybeSingle();
  const election = data as ElectionRow | null;
  if (!election || !election.fundraiser_enabled || election.is_practice || election.status === "draft") notFound();

  const { data: races } = await admin.from("live_vote_events").select("id, title, election_sort").eq("election_id", id).order("election_sort");
  const raceIds = (races ?? []).map((r) => r.id);
  const [{ data: options }, { data: gifts }] = await Promise.all([
    raceIds.length ? admin.from("live_vote_options").select("id, event_id, name, sort_order").in("event_id", raceIds).order("sort_order") : Promise.resolve({ data: [] }),
    raceIds.length ? admin.from("live_vote_super_votes").select("amount_cents").in("event_id", raceIds) : Promise.resolve({ data: [] }),
  ]);
  const raised = (gifts ?? []).reduce((s, g) => s + g.amount_cents, 0);

  return (
    <ElectionBrandFrame id={id}>
      <div className="mx-auto max-w-2xl px-5 py-8">
        <ElectionSupport
          id={id}
          title={election.title}
          school={election.school_name}
          open={isOpen(election)}
          thanks={thanks === "1"}
          raisedCents={raised}
          goalCents={election.fundraiser_goal_cents}
          sharePct={Math.round(SUPER_VOTES.organizerShare * 100)}
          packs={SUPER_VOTES.packs.map((p) => ({ key: p.key, cents: p.cents }))}
          races={(races ?? []).map((r) => ({ id: r.id, title: r.title, candidates: (options ?? []).filter((o) => o.event_id === r.id).map((o) => ({ id: o.id, name: o.name })) }))}
        />
      </div>
    </ElectionBrandFrame>
  );
}
