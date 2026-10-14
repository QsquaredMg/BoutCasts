import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PredHero from "@/components/PredHero";
import PredBracketBuilder from "@/components/PredBracketBuilder";

export const metadata: Metadata = {
  title: "Create a game slate",
  description: "Schedule several games on one leaderboard, pay once, and let your players predict every winner and score for free.",
  robots: { index: false },
};

export default async function NewBracketPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=${encodeURIComponent("/predictions/bracket/new")}`);
  return (
    <>
      <PredHero small kicker="Game slates" title="Create a game slate" sub={<>Schedule many games on one leaderboard. Each game locks 15 minutes after it starts, and you enter the final scores as games finish. Want an elimination tournament instead? <Link href="/predictions/tournament/new" style={{ textDecoration: "underline" }}>Build a tournament bracket</Link>.</>} />
      <div className="pt-body">
      <PredBracketBuilder />
      </div>
    </>
  );
}
