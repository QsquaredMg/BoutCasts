import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { resolveRange, type RangeParams } from "@/lib/analytics/range";
import { loadCurrentAndPrev, n } from "@/lib/analytics/data";
import { AnalyticsShell, BarList, DataTable, Panel, StatCard, StatGrid, TrendChart, Unavailable } from "@/components/analytics/ui";

export const metadata: Metadata = {
  title: "Traffic analytics",
  description: "Visits, page views, traffic sources, top pages, devices and countries for BoutCasts.",
};

type Traffic = {
  totals: { pageviews: number; visits: number; signed_in_visits: number; pages_per_visit: number; bounce_rate: number };
  daily: { day: string; visits: number; pageviews: number }[];
  top_pages: { path: string; views: number; visits: number }[];
  page_types: { type: string; views: number }[];
  entry_pages: { path: string; visits: number }[];
  channels: { channel: string; visits: number }[];
  referrers: { host: string; visits: number }[];
  campaigns: { source: string; medium: string | null; visits: number }[];
  devices: { device: string; visits: number }[];
  countries: { country: string; visits: number }[];
  hours: { hour: number; views: number }[];
};

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "a" : "p"}`;

export default async function TrafficPage({ searchParams }: { searchParams: Promise<RangeParams> }) {
  const r = resolveRange(await searchParams);
  const supabase = await createClient();
  const { cur, prev } = await loadCurrentAndPrev<Traffic>(supabase, "traffic", r);
  if (!cur) return <AnalyticsShell range={r} active="traffic" title="Traffic" intro=""><Unavailable /></AnalyticsShell>;
  const t = cur.totals, p = prev?.totals;
  const peak = [...cur.hours].sort((a, b) => b.views - a.views)[0];

  return (
    <AnalyticsShell
      range={r}
      active="traffic"
      title="Traffic"
      intro="Who is visiting and where they come from. A visit is one browser session; bots are filtered out and no IP addresses are stored. Admin pages and advertiser reports are never counted."
      exportKind="pages"
    >
      <StatGrid>
        <StatCard label="Visits" value={n(t.visits)} cur={t.visits} prev={p?.visits} sub={`${n(t.signed_in_visits)} signed in`} />
        <StatCard label="Page views" value={n(t.pageviews)} cur={t.pageviews} prev={p?.pageviews} />
        <StatCard label="Pages per visit" value={String(t.pages_per_visit)} />
        <StatCard label="Bounce rate" value={`${t.bounce_rate}%`} sub="visits that viewed one page" />
      </StatGrid>

      <Panel title="Visits and page views per day">
        <TrendChart days={cur.daily.map((d) => d.day)} label="Visits and page views per day" series={[{ name: "Visits", values: cur.daily.map((d) => d.visits) }, { name: "Page views", values: cur.daily.map((d) => d.pageviews) }]} />
      </Panel>

      <Panel title="Where visitors come from" note="Channel of each visit's first page.">
        <BarList rows={cur.channels.map((c) => ({ label: c.channel, value: c.visits }))} />
      </Panel>
      <Panel title="Top referring sites">
        <BarList rows={cur.referrers.map((c) => ({ label: c.host, value: c.visits }))} empty="No referring sites yet." />
      </Panel>
      <Panel title="Campaigns (UTM links, QR codes, flyers)" note="Add ?utm_source=flyer&utm_medium=qr to a link to see it here.">
        <DataTable rows={cur.campaigns} empty="No tagged links used yet." cols={[
          { label: "Source", render: (c) => c.source },
          { label: "Medium", render: (c) => c.medium ?? "-" },
          { label: "Visits", align: "right", render: (c) => n(c.visits) },
        ]} />
      </Panel>

      <Panel title="Top pages">
        <DataTable rows={cur.top_pages} cols={[
          { label: "Page", render: (c) => <span className="break-all">{c.path}</span> },
          { label: "Views", align: "right", render: (c) => n(c.views) },
          { label: "Visits", align: "right", render: (c) => n(c.visits) },
        ]} />
      </Panel>
      <Panel title="Page types" note="Bout, vote and prediction pages grouped together.">
        <BarList rows={cur.page_types.map((c) => ({ label: c.type, value: c.views }))} />
      </Panel>
      <Panel title="Landing pages" note="The first page of each visit.">
        <BarList rows={cur.entry_pages.map((c) => ({ label: c.path, value: c.visits }))} />
      </Panel>

      <Panel title="Devices">
        <BarList rows={cur.devices.map((c) => ({ label: c.device, value: c.visits }))} />
      </Panel>
      <Panel title="Countries" note="From the request's location header; ?? means unknown.">
        <BarList rows={cur.countries.map((c) => ({ label: c.country, value: c.visits }))} />
      </Panel>
      <Panel title="Busiest hours (Central time)" note={peak && peak.views > 0 ? `Peak: ${hourLabel(peak.hour)} with ${n(peak.views)} page views.` : undefined}>
        <TrendChart days={cur.hours.map((h) => hourLabel(h.hour))} kind="bar" label="Page views by hour of day" series={[{ name: "Page views", values: cur.hours.map((h) => h.views) }]} />
      </Panel>
    </AnalyticsShell>
  );
}
