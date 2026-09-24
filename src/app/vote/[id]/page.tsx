import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import LiveVoteBallot from "@/components/LiveVoteBallot";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("live_vote_events")
    .select("title, brand_name")
    .eq("id", id)
    .maybeSingle();

  if (!event) {
    return { title: "Live Vote" };
  }

  const title = event.title;
  const description = event.brand_name
    ? `Presented by ${event.brand_name} — cast your vote, or start your own Bout, on BoutCasts.`
    : "Cast your vote — or start your own Bout — on BoutCasts.";

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default async function VotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <LiveVoteBallot eventId={id} />
    </div>
  );
}
