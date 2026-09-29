import type { Metadata } from "next";
import DebateMatchView from "@/components/debates/DebateMatchView";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("debate_matches").select("debate_topics(statement)").eq("id", id).maybeSingle();
  const statement = (data?.debate_topics as unknown as { statement: string } | null)?.statement;
  return {
    title: statement ? `Debate: ${statement}` : "Debate",
    description: "Watch both sides of the debate and vote for the winner on BoutCasts.",
  };
}

export default async function DebateMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DebateMatchView matchId={id} />;
}
