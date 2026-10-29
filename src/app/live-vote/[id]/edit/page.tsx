import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LiveVoteEditForm from "@/components/LiveVoteEditForm";

export const metadata = { title: "Edit Live Vote" };

export default async function EditLiveVotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=/live-vote/${id}/edit`);
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <LiveVoteEditForm eventId={id} />
    </div>
  );
}
