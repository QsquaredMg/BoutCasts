import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PredHero from "@/components/PredHero";
import TourneyBuilder from "@/components/TourneyBuilder";

export const metadata: Metadata = {
  title: "Create a tournament bracket",
  description: "Build a March Madness style bracket for any tournament. Players fill it out free, wins and losses decide the standings, and the leaderboard updates after every game.",
  robots: { index: false },
};

export default async function NewTournamentPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=${encodeURIComponent("/predictions/tournament/new")}`);
  return (
    <>
      <PredHero small kicker="Tournament brackets" title="Create a tournament bracket" sub="Build it free. Players fill out the whole bracket before Round 1, and the leaderboard updates after every game." />
      <div className="pt-body">
        <TourneyBuilder />
      </div>
    </>
  );
}
