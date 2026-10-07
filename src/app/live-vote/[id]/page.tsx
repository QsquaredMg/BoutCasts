import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import LiveVoteEventManager from "@/components/LiveVoteEventManager";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("live_vote_events").select("title").eq("id", id).maybeSingle();
  return { title: data?.title ? `${data.title} — Live Vote` : "Live Vote" };
}

export default async function LiveVoteEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { id } = await params;
  const { checkout } = await searchParams;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <LiveVoteEventManager eventId={id} checkoutStatus={checkout ?? null} />
    </div>
  );
}
