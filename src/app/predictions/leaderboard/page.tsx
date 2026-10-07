import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PredHero from "@/components/PredHero";
import PredLeaderboardTable from "@/components/PredLeaderboardTable";
import type { LeaderRow } from "@/lib/predictions/types";

export const metadata: Metadata = {
  title: "Prediction leaderboard",
  description: "The best game predictors on BoutCasts this week and this season, ranked by points for winners and exact scores.",
  alternates: { canonical: "/predictions/leaderboard" },
};

export default async function PredLeaderboardPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const { scope: s } = await searchParams;
  const scope = s === "season" ? "season" : "week";
  const supabase = await createClient();
  const [{ data: auth }, { data }] = await Promise.all([supabase.auth.getUser(), supabase.rpc("pred_leaderboard", { p_scope: scope, p_limit: 50 })]);
  const tab = (key: string, label: string) => (
    <Link href={`/predictions/leaderboard?scope=${key}`} aria-current={scope === key ? "page" : undefined} className="rounded-full px-4 py-2 text-sm font-bold" style={{ background: scope === key ? "#ffc531" : "rgba(255,255,255,.1)", color: scope === key ? "#0a0f2c" : "#dbe3ff" }}>
      {label}
    </Link>
  );
  return (
    <>
      <PredHero
        kicker="Separate from your voting points"
        title="Prediction leaderboard"
        sub="Ties are broken by perfect calls, then correct winners."
      >
        <div className="mt-5 flex gap-2">{tab("week", "Last 7 days")}{tab("season", "This season")}</div>
      </PredHero>
      <div className="pt-body">
        <PredLeaderboardTable rows={(data ?? []) as LeaderRow[]} meId={auth.user?.id} />
      </div>
    </>
  );
}
