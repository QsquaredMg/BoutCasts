import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { resolveRange, type RangeParams } from "@/lib/analytics/range";
import { loadCurrentAndPrev, money, n, pct } from "@/lib/analytics/data";
import { loadStripeRevenue } from "@/lib/analytics/stripeRevenue";
import { AnalyticsShell, BarList, DataTable, Panel, StatCard, StatGrid, TrendChart, Unavailable } from "@/components/analytics/ui";

export const metadata: Metadata = {
  title: "Growth and revenue",
  description: "Signups, conversion funnel, audience breakdown and revenue for BoutCasts.",
};

type Label = { label: string; count: number };
type Growth = {
  funnel: { visits: number; signups: number; activated: number; returned: number; referred: number };
  daily_signups: { day: string; signups: number }[];
  audience: { total_users: number; gender: Label[]; ethnicity: Label[]; age: Label[] };
  revenue: {
    brackets_paid: number; live_events_paid: number; active_organizer_subs: number;
    bracket_sponsor_cents: number; live_sponsor_cents: number;
    sponsor_applications: number; sponsor_applications_approved: number;
  };
};

export default async function GrowthPage({ searchParams }: { searchParams: Promise<RangeParams> }) {
  const r = resolveRange(await searchParams);
  const supabase = await createClient();
  const [{ cur, prev }, stripe] = await Promise.all([
    loadCurrentAndPrev<Growth>(supabase, "growth", r),
    loadStripeRevenue(r.from, r.to),
  ]);
  if (!cur) return <AnalyticsShell range={r} active="growth" title="Growth and revenue" intro=""><Unavailable /></AnalyticsShell>;
  const f = cur.funnel, rv = cur.revenue;
  const steps = [
    { label: "Visits", value: f.visits, hint: "" },
    { label: "Signed up", value: f.signups, hint: pct(f.signups, f.visits) + " of visits" },
    { label: "Voted or predicted", value: f.activated, hint: pct(f.activated, f.signups) + " of signups" },
    { label: "Came back another day", value: f.returned, hint: pct(f.returned, f.signups) + " of signups" },
  ];

  return (
    <AnalyticsShell
      range={r}
      active="growth"
      title="Growth and revenue"
      intro="How many people join, whether they stick, who they are, and what's being paid for."
      exportKind="signups"
    >
      <StatGrid>
        <StatCard label="New signups" value={n(f.signups)} cur={f.signups} prev={prev?.funnel.signups} />
        <StatCard label="Signup rate" value={pct(f.signups, f.visits)} sub="of visits" />
        <StatCard label="Referred signups" value={n(f.referred)} cur={f.referred} prev={prev?.funnel.referred} />
        <StatCard label="All users" value={n(cur.audience.total_users)} />
      </StatGrid>

      <Panel title="Signups per day">
        <TrendChart days={cur.daily_signups.map((d) => d.day)} kind="bar" label="Signups per day" series={[{ name: "Signups", values: cur.daily_signups.map((d) => d.signups) }]} />
      </Panel>

      <Panel title="From visit to regular" note="Counts people who signed up in this period. Visits only count since page tracking began.">
        <BarList rows={steps.map((s) => ({ label: s.label, value: s.value, hint: s.hint || undefined }))} />
      </Panel>

      <h4 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Revenue</h4>
      <StatGrid>
        <StatCard
          label={`Stripe revenue (${stripe?.mode ?? "n/a"} mode)`}
          value={stripe ? money(stripe.total_cents) : "-"}
          sub={stripe ? `${n(stripe.count)} paid checkouts` : "Stripe not reachable"}
        />
        <StatCard label="Brackets paid" value={n(rv.brackets_paid)} />
        <StatCard label="Live Vote events paid" value={n(rv.live_events_paid)} />
        <StatCard label="Organizer subscriptions" value={n(rv.active_organizer_subs)} sub="active now" />
      </StatGrid>
      <Panel title="What was sold" note={stripe?.truncated ? "Showing the first 500 checkouts in this period." : stripe ? "Paid Checkout sessions from Stripe." : "Add STRIPE_SECRET_KEY to see this."}>
        <DataTable rows={stripe?.by_kind ?? []} empty="No paid checkouts in this period." cols={[
          { label: "Product", render: (x) => x.kind },
          { label: "Orders", align: "right", render: (x) => n(x.count) },
          { label: "Revenue", align: "right", render: (x) => money(x.cents) },
        ]} />
      </Panel>
      <Panel title="Sponsor pipeline">
        <DataTable
          rows={[
            { k: "Sponsor inquiries", v: String(rv.sponsor_applications) },
            { k: "Approved", v: `${rv.sponsor_applications_approved} (${pct(rv.sponsor_applications_approved, rv.sponsor_applications)})` },
            { k: "Bracket sponsor packages recorded", v: money(rv.bracket_sponsor_cents) },
            { k: "Live Vote sponsor packages recorded", v: money(rv.live_sponsor_cents) },
          ]}
          cols={[{ label: "Measure", render: (x) => x.k }, { label: "Value", align: "right", render: (x) => x.v }]}
        />
      </Panel>

      <h4 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Audience (all users, self-reported)</h4>
      <Panel title="Age"><BarList rows={cur.audience.age.map((a) => ({ label: a.label, value: a.count }))} /></Panel>
      <Panel title="Gender"><BarList rows={cur.audience.gender.map((a) => ({ label: a.label, value: a.count }))} /></Panel>
      <Panel title="Ethnicity" note="Shown to admins only, in aggregate. It is never included in advertiser reports.">
        <BarList rows={cur.audience.ethnicity.map((a) => ({ label: a.label, value: a.count }))} />
      </Panel>
    </AnalyticsShell>
  );
}
