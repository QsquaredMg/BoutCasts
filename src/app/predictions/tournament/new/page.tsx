import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PredHero from "@/components/PredHero";
import TourneyBuilder from "@/components/TourneyBuilder";

export const metadata: Metadata = {
  title: "Create a bracket",
  description: "Build a bracket where final scores or crowd votes move the winners forward. Players fill it out free and the leaderboard updates after every round.",
  robots: { index: false },
};

export default async function NewTournamentPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const initialMode = mode === "votes" ? "votes" : "score";
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=${encodeURIComponent(`/predictions/tournament/new${initialMode === "votes" ? "?mode=votes" : ""}`)}`);
  return (
    <>
      <PredHero small kicker="Brackets" title="Create a bracket" sub="Choose what moves winners forward: the final scores you enter, or the crowd's votes. Players fill out the whole bracket free." />
      <div className="pt-body">
        <TourneyBuilder initialMode={initialMode} />
      </div>
    </>
  );
}
