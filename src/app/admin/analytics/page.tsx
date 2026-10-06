import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveRange, rangeQuery, type RangeParams } from "@/lib/analytics/range";
import { loadCurrentAndPrev, n, pct } from "@/lib/analytics/data";
import { AnalyticsShell, Panel, StatCard, StatGrid, TrendChart, Unavailable } from "@/components/analytics/ui";

export const metadata: Metadata = {
  title: "Analytics overview",
  description: "Admin overview of visits, votes, signups and ad performance across BoutCasts.",
};

type Totals = {
  pageviews: number; visits: number; signups: number; votes: number; predictions: number;
  ad_impressions: number; ad_clicks: number; shares: number;
};
type Overview = {
  totals: Totals;
  daily: { day: string; visits: number; pageviews: number; signups: number; votes: number; ad_impressions: number; ad_clicks: number }[];
};

export default async function AnalyticsOverviewPage({ searchParams }: { searchParams: Promise<RangeParams> }) {
  const r = resolveRange(await searchParams);
  const supabase = await createClient();
  const { cur, prev } = await loadCurrentAndPrev<Overview>(supabase, "overview", r);

  if (!cur) {
    return (
      <AnalyticsShell range={r} active="overview" title="Overview" intro="Everything at a glance.">
        <Unavailable />
      </AnalyticsShell>
    );
  }
  const t = cur.totals;
  const p = prev?.totals;
  const days = cur.daily.map((d) => d.day);
  const col = (k: keyof Overview["daily"][number]) => cur.daily.map((d) => Number(d[k]));

  return (
    <AnalyticsShell
      range={r}
      active="overview"
      title="Overview"
      intro={`${r.label} (${r.fromDay} to ${r.toDay}). Visits are counted once per browser session. Numbers start from the day tracking was switched on.`}
    >
      <StatGrid>
        <StatCard label="Visits" value={n(t.visits)} cur={t.visits} prev={p?.visits} sub={`${n(t.pageviews)} page views`} />
        <StatCard label="New signups" value={n(t.signups)} cur={t.signups} prev={p?.signups} />
        <StatCard label="Votes cast" value={n(t.votes)} cur={t.votes} prev={p?.votes} sub="bouts, showcases, live vote" />
        <StatCard label="Predictions entered" value={n(t.predictions)} cur={t.predictions} prev={p?.predictions} />
        <StatCard label="Ad impressions" value={n(t.ad_impressions)} cur={t.ad_impressions} prev={p?.ad_impressions} />
        <StatCard label="Ad clicks" value={n(t.ad_clicks)} cur={t.ad_clicks} prev={p?.ad_clicks} sub={`${pct(t.ad_clicks, t.ad_impressions)} click rate`} />
        <StatCard label="Shares" value={n(t.shares)} cur={t.shares} prev={p?.shares} />
        <StatCard label="Votes per visit" value={t.visits > 0 ? (t.votes / t.visits).toFixed(2) : "-"} />
      </StatGrid>

      <Panel title="Visits and page views per day">
        <TrendChart days={days} label="Visits and page views per day" series={[{ name: "Visits", values: col("visits") }, { name: "Page views", values: col("pageviews") }]} />
      </Panel>
      <Panel title="Votes per day">
        <TrendChart days={days} kind="bar" label="Votes per day" series={[{ name: "Votes", values: col("votes") }]} />
      </Panel>
      <Panel title="Signups per day">
        <TrendChart days={days} kind="bar" label="Signups per day" series={[{ name: "Signups", values: col("signups") }]} />
      </Panel>
      <Panel title="Ad impressions per day">
        <TrendChart days={days} label="Ad impressions per day" series={[{ name: "Impressions", values: col("ad_impressions") }]} />
      </Panel>

      <div className="flex flex-wrap gap-2 text-sm font-semibold">
        {[
          ["ads", "Ad runs and advertisers"],
          ["traffic", "Traffic sources"],
          ["engagement", "Bouts, Live Vote and predictions"],
          ["growth", "Growth, audience and revenue"],
        ].map(([slug, label]) => (
          <Link key={slug} href={`/admin/analytics/${slug}${rangeQuery(r)}`} className="underline" style={{ color: "var(--blue)" }}>
            {label} →
          </Link>
        ))}
      </div>
    </AnalyticsShell>
  );
}
