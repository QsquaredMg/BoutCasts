import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PredHero from "@/components/PredHero";
import PrivateGameBuilder from "@/components/PrivateGameBuilder";

export const metadata: Metadata = {
  title: "Create a private prediction game",
  description: "A closed, invite-only prediction game for your group. Share a private link and a 6-letter code. Players always play free.",
  robots: { index: false },
};

export default async function NewPrivatePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=${encodeURIComponent("/predictions/private/new")}`);
  return (
    <>
      <PredHero small kicker="🔒 Invite-only · players always free" title="Create a private game" sub="Closed and invite-only: just your people, with their own private leaderboard. No limit on using a matchup that already exists publicly." />
      <div className="pt-body">
      <PrivateGameBuilder />
      </div>
    </>
  );
}
