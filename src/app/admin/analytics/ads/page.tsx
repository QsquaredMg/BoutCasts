import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveRange, runState, type RangeParams } from "@/lib/analytics/range";
import { loadCurrentAndPrev, n, pct } from "@/lib/analytics/data";
import { AnalyticsShell, BarList, DataTable, Panel, StatCard, StatGrid, TrendChart, Unavailable } from "@/components/analytics/ui";

export const metadata: Metadata = {
  title: "Ad analytics",
  description: "Ad runs, impressions, clicks and click rate by ad, advertiser, placement and device.",
};

type AdRow = {
  id: string; headline: string | null; placement: string; media_type: string; status: string;
  starts_at: string | null; ends_at: string | null; sponsor_id: string | null; sponsor_name: string;
  impressions: number; unique_viewers: number; clicks: number;
};
type Ads = {
  totals: { impressions: number; clicks: number; unique_viewers: number; active_ads: number };
  ads: AdRow[];
  sponsors: { sponsor_id: string | null; name: string; ads: number; impressions: number; unique_viewers: number; clicks: number }[];
  placements: { placement: string; ads: number; impressions: number; clicks: number }[];
  devices: { device: string; impressions: number }[];
  pages: { path: string; impressions: number; clicks: number }[];
  daily: { day: string; impressions: number; clicks: number }[];
  strips: { prediction: Record<string, number>; live_vote: Record<string, number> };
};

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" }) : null);
const runWindow = (a: AdRow) => {
  const s = fmtDate(a.starts_at), e = fmtDate(a.ends_at);
  return s || e ? `${s ?? "Any time"} → ${e ?? "No end"}` : "Always on";
};

export default async function AdAnalyticsPage({ searchParams }: { searchParams: Promise<RangeParams> }) {
  const r = resolveRange(await searchParams);
  const supabase = await createClient();
  const { cur, prev } = await loadCurrentAndPrev<Ads>(supabase, "ads", r);
  if (!cur) {
    return (
      <AnalyticsShell range={r} active="ads" title="Ad runs and advertisers" intro="">
        <Unavailable />
      </AnalyticsShell>
    );
  }
  const t = cur.totals;
  const p = prev?.totals;
  const days = cur.daily.map((d) => d.day);
  const stripV = cur.strips.prediction.view ?? 0;
  const stripC = cur.strips.prediction.click ?? 0;
  const liveV = cur.strips.live_vote.view ?? cur.strips.live_vote.impression ?? 0;
  const liveC = cur.strips.live_vote.click ?? 0;

  return (
    <AnalyticsShell
      range={r}
      active="ads"
      title="Ad runs and advertisers"
      intro="Which ads ran, where, for how long, and what they delivered. Unique viewers counts distinct visits; older impressions from before tracking don't have a visit id, so treat unique viewers as a floor."
      exportKind="ads"
    >
      <StatGrid>
        <StatCard label="Impressions" value={n(t.impressions)} cur={t.impressions} prev={p?.impressions} />
        <StatCard label="Unique viewers" value={n(t.unique_viewers)} cur={t.unique_viewers} prev={p?.unique_viewers} />
        <StatCard label="Clicks" value={n(t.clicks)} cur={t.clicks} prev={p?.clicks} />
        <StatCard label="Click rate" value={pct(t.clicks, t.impressions)} sub={`${n(t.active_ads)} ads running now`} />
      </StatGrid>

      <Panel title="Impressions per day">
        <TrendChart days={days} label="Ad impressions per day" series={[{ name: "Impressions", values: cur.daily.map((d) => d.impressions) }]} />
      </Panel>

      <Panel title="Every ad run" note="Run window comes from each ad's start and end dates in Admin → Ads.">
        <DataTable
          rows={cur.ads}
          empty="No ads yet."
          cols={[
            { label: "Ad", render: (a) => (<><div className="font-semibold">{a.headline || "(no headline)"}</div><div className="text-xs" style={{ color: "var(--text-faint)" }}>{a.sponsor_name} · {a.media_type}</div></>) },
            { label: "Placement", render: (a) => a.placement },
            { label: "Run", render: (a) => (<><div>{runState(a.status, a.starts_at, a.ends_at)}</div><div className="text-xs" style={{ color: "var(--text-faint)" }}>{runWindow(a)}</div></>) },
            { label: "Views", align: "right", render: (a) => n(a.impressions) },
            { label: "Unique", align: "right", render: (a) => n(a.unique_viewers) },
            { label: "Clicks", align: "right", render: (a) => n(a.clicks) },
            { label: "CTR", align: "right", render: (a) => pct(a.clicks, a.impressions) },
          ]}
        />
      </Panel>

      <Panel title="By advertiser" note="Open an advertiser's shareable report from Report links.">
        <DataTable
          rows={cur.sponsors}
          cols={[
            { label: "Advertiser", render: (s) => (s.sponsor_id ? <Link href={`/admin/analytics/links?sponsor=${s.sponsor_id}`} className="font-semibold underline" style={{ color: "var(--blue)" }}>{s.name}</Link> : s.name) },
            { label: "Ads", align: "right", render: (s) => n(s.ads) },
            { label: "Views", align: "right", render: (s) => n(s.impressions) },
            { label: "Clicks", align: "right", render: (s) => n(s.clicks) },
            { label: "CTR", align: "right", render: (s) => pct(s.clicks, s.impressions) },
          ]}
        />
      </Panel>

      <Panel title="Impressions by placement">
        <BarList rows={cur.placements.map((x) => ({ label: x.placement, value: x.impressions, hint: `${pct(x.clicks, x.impressions)} CTR` }))} />
      </Panel>
      <Panel title="Impressions by device" note="Only impressions recorded since device tracking began.">
        <BarList rows={cur.devices.map((x) => ({ label: x.device, value: x.impressions }))} />
      </Panel>
      <Panel title="Pages where ads ran" note="Top pages by impressions, recorded since page tracking began.">
        <BarList rows={cur.pages.map((x) => ({ label: x.path, value: x.impressions, hint: `${x.clicks} clicks` }))} />
      </Panel>
      <Panel title="Sponsor strips (separate from ads)">
        <DataTable
          rows={[
            { name: "Prediction bracket sponsors", v: stripV, c: stripC },
            { name: "Live Vote event sponsors", v: liveV, c: liveC },
          ]}
          cols={[
            { label: "Placement", render: (x) => x.name },
            { label: "Views", align: "right", render: (x) => n(x.v) },
            { label: "Clicks", align: "right", render: (x) => n(x.c) },
            { label: "CTR", align: "right", render: (x) => pct(x.c, x.v) },
          ]}
        />
      </Panel>
    </AnalyticsShell>
  );
}
