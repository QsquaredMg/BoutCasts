import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PredHero from "@/components/PredHero";
import NewGameForm from "@/components/NewGameForm";

export const metadata: Metadata = {
  title: "Create a prediction game",
  description: "Set up a game with two teams, a start time and optional weekly slate so fans can predict the winner and score.",
  robots: { index: false },
};

export default async function NewGamePage({ searchParams }: { searchParams: Promise<{ slate?: string }> }) {
  const { slate } = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=${encodeURIComponent("/predictions/new")}`);
  let preset: string | null = null;
  if (slate) {
    const { data: owned } = await supabase.from("pred_slates").select("id, kind, created_by").eq("id", slate).maybeSingle();
    if (owned && owned.kind === "slate" && owned.created_by === auth.user.id) preset = owned.id;
  }

  return (
    <>
      <PredHero
        small
        kicker="Free for organizers · free for players"
        title={preset ? "Add a game to your slate" : "Create your free game"}
        sub="Add both teams and the start time. Predictions stay open for 15 minutes after the game starts, and you enter the final score afterward."
      />
      <div className="pt-body">
      <NewGameForm presetSlate={preset} />
      {!preset && (
        <p className="pt-info mt-6">
          Every account gets one free single game per day, open for 24 hours. Need more games, an elimination bracket or a longer schedule?{" "}
          <Link href="/predictions/bracket/new" className="font-bold underline" style={{ color: "#ffc531" }}>Create a bracket</Link>. Want it just for your group? <Link href="/predictions/private/new" className="font-bold underline" style={{ color: "#ffc531" }}>Make a private game for $5</Link>.
        </p>
      )}
      </div>
    </>
  );
}
