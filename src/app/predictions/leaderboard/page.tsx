import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
    <Link href={`/predictions/leaderboard?scope=${key}`} aria-current={scope === key ? "page" : undefined} className="rounded-full px-4 py-2 text-sm font-bold" style={{ background: scope === key ? "var(--blue)" : "var(--surface-2)", color: scope === key ? "#fff" : "var(--text-dim)" }}>
      {label}
    </Link>
  );
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/predictions" className="mb-4 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>&larr; Bout Predictions</Link>
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Prediction leaderboard</h1>
      <p className="mb-4 text-sm" style={{ color: "var(--text-faint)" }}>Separate from your voting points. Ties are broken by perfect calls, then correct winners.</p>
      <div className="mb-4 flex gap-2">{tab("week", "Last 7 days")}{tab("season", "This season")}</div>
      <PredLeaderboardTable rows={(data ?? []) as LeaderRow[]} meId={auth.user?.id} />
    </div>
  );
}
