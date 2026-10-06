import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadReportByToken, periodLabel, placementLabel } from "@/lib/analytics/report";
import { n, pct } from "@/lib/analytics/data";
import { BarList, DataTable, Panel, StatCard, TrendChart } from "@/components/analytics/ui";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Advertiser report",
  description: "A private BoutCasts results report for an advertiser.",
  robots: { index: false, follow: false },
};

const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" }) : null);

export default async function AdvertiserReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rep = await loadReportByToken(token);
  if (!rep) notFound();
  const t = rep.totals;
  const moments = t.votes + t.shares + t.graphics + t.ad_impressions;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: "var(--blue)" }}>BoutCasts results</p>
        <div className="flex gap-2">
          <a href={`/report/${token}/pdf`} className="bc-btn-solid rounded-full px-4 py-1.5 text-xs font-bold">Download PDF</a>
          <PrintButton label="Print" />
        </div>
      </div>

      <header className="mb-5 rounded-2xl border p-6 sm:p-8" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/boutcasts-wordmark.png" alt="BoutCasts" className="mb-4 h-8 w-auto" />
            <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{rep.sponsor.name}</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>Sponsor results · {periodLabel(rep)}</p>
          </div>
          {rep.sponsor.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={rep.sponsor.logo_url} alt="" className="h-14 w-auto max-w-[180px] object-contain" />
          )}
        </div>
        <p className="mt-5 text-sm" style={{ color: "var(--text-dim)" }}>
          <strong>{moments.toLocaleString()}</strong> brand moments: ad views, plus votes, shares and graphics on matchups you presented.
        </p>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Ad views" value={n(t.ad_impressions)} sub={`${n(t.ad_unique_viewers)} unique viewers`} />
        <StatCard label="Ad clicks" value={n(t.ad_clicks)} sub={`${pct(t.ad_clicks, t.ad_impressions)} click rate`} />
        <StatCard label="Votes on your matchups" value={n(t.votes)} sub={`${n(t.unique_accounts)} signed-in voters`} />
        <StatCard label="Shares" value={n(t.shares)} />
        <StatCard label="Vote graphics opened" value={n(t.graphics)} sub="each shows your logo" />
        <StatCard label="Sponsored matchups" value={n(t.bouts)} />
      </div>

      {rep.daily.length > 1 && (
        <Panel title="Ad views per day">
          <TrendChart days={rep.daily.map((d) => d.day)} label="Ad views per day" series={[{ name: "Ad views", values: rep.daily.map((d) => d.impressions) }]} />
        </Panel>
      )}

      <Panel title="Your ads" note="Where each ad ran and what it delivered.">
        <DataTable rows={rep.ads} empty="No ads have run yet." cols={[
          { label: "Ad", render: (a) => (<><div className="font-semibold">{a.headline || "Ad"}</div><div className="text-xs" style={{ color: "var(--text-faint)" }}>{placementLabel(a.placement)} · {fmt(a.starts_at) ?? "Started"} → {fmt(a.ends_at) ?? "ongoing"}</div></>) },
          { label: "Views", align: "right", render: (a) => n(a.impressions) },
          { label: "Unique", align: "right", render: (a) => n(a.unique_viewers) },
          { label: "Clicks", align: "right", render: (a) => n(a.clicks) },
          { label: "CTR", align: "right", render: (a) => pct(a.clicks, a.impressions) },
        ]} />
      </Panel>

      {rep.placements.length > 0 && (
        <Panel title="Where your ads appeared">
          <BarList rows={rep.placements.map((p) => ({ label: placementLabel(p.placement), value: p.impressions, hint: `${pct(p.clicks, p.impressions)} click rate` }))} />
        </Panel>
      )}
      {rep.devices.some((d) => d.device !== "unknown") && (
        <Panel title="Devices" note="Recorded for recent views.">
          <BarList rows={rep.devices.filter((d) => d.device !== "unknown").map((d) => ({ label: d.device, value: d.impressions }))} />
        </Panel>
      )}

      <Panel title="Matchups you presented">
        <DataTable rows={rep.bouts.slice(0, 15)} empty="No matchups are linked to this sponsor yet." cols={[
          { label: "Matchup", render: (b) => (<><Link href={`/bout/${b.id}`} className="font-semibold hover:underline">{b.competitor_a_name} vs {b.competitor_b_name}</Link><div className="text-xs" style={{ color: "var(--text-faint)" }}>{b.status === "final" ? "Final" : b.status === "live" ? "Live" : "Upcoming"}</div></>) },
          { label: "Votes", align: "right", render: (b) => n(b.votes) },
          { label: "Shares", align: "right", render: (b) => n(b.shares) },
          { label: "Graphics", align: "right", render: (b) => n(b.graphics) },
        ]} />
      </Panel>

      <p className="mt-6 text-[11px]" style={{ color: "var(--text-faint)" }}>
        Counts come from BoutCasts records. Bots and crawlers are excluded. A view is one ad shown on screen; unique viewers counts distinct
        visits, so earlier views without a visit id may be counted once each. Shares count taps on Share; the person may cancel before posting.
        Generated {new Date(rep.generated_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Chicago" })} Central.
      </p>
    </div>
  );
}
