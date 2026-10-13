import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PredHero from "@/components/PredHero";
import PredBracketBuilder from "@/components/PredBracketBuilder";

export const metadata: Metadata = {
  title: "Create a prediction bracket",
  description: "Set up an elimination bracket or a slate of games, pay once, and let your players predict every winner and score for free.",
  robots: { index: false },
};

export default async function NewBracketPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=${encodeURIComponent("/predictions/bracket/new")}`);
  return (
    <>
      <PredHero small kicker="Brackets and slates" title="Create a bracket" sub="Schedule many games at once. Predictions lock the moment the first game starts, and you enter the final scores as games finish." />
      <div className="pt-body">
      <PredBracketBuilder />
      </div>
    </>
  );
}
