import type { Metadata } from "next";
import { redirect } from "next/navigation";
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

  // This is the organizer's management page. Anyone else (a voter with an old or shared link,
  // a signed-out visitor) goes to the public ballot instead.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  let allowed = false;
  if (auth.user) {
    const [{ data: ev }, { data: me }] = await Promise.all([
      supabase.from("live_vote_events").select("organizer_id").eq("id", id).maybeSingle(),
      supabase.from("profiles").select("is_admin").eq("id", auth.user.id).maybeSingle(),
    ]);
    allowed = ev?.organizer_id === auth.user.id || !!me?.is_admin;
  }
  if (!allowed) redirect(`/vote/${id}`);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <LiveVoteEventManager eventId={id} checkoutStatus={checkout ?? null} />
    </div>
  );
}
