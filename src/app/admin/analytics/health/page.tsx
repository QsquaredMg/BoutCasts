import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveRange, type RangeParams } from "@/lib/analytics/range";
import { loadSection, n } from "@/lib/analytics/data";
import { AnalyticsShell, DataTable, Panel, StatCard, StatGrid, TrendChart, Unavailable } from "@/components/analytics/ui";

export const metadata: Metadata = {
  title: "Site health",
  description: "Errors, push subscribers and notification volume for BoutCasts.",
};

type Health = {
  errors_total: number; push_subscribers: number; notifications_sent: number;
  daily_errors: { day: string; errors: number }[];
  top_errors: { message: string; count: number; last_seen: string; path: string | null }[];
};

export default async function HealthPage({ searchParams }: { searchParams: Promise<RangeParams> }) {
  const r = resolveRange(await searchParams);
  const supabase = await createClient();
  const cur = await loadSection<Health>(supabase, "health", r.from, r.to);
  if (!cur) return <AnalyticsShell range={r} active="health" title="Health" intro=""><Unavailable /></AnalyticsShell>;

  return (
    <AnalyticsShell range={r} active="health" title="Health" intro="Errors and delivery basics. Email delivery stats live in your Resend dashboard.">
      <StatGrid>
        <StatCard label="Errors logged" value={n(cur.errors_total)} />
        <StatCard label="Push subscribers" value={n(cur.push_subscribers)} sub="all time" />
        <StatCard label="Notifications sent" value={n(cur.notifications_sent)} />
      </StatGrid>
      <Panel title="Errors per day">
        <TrendChart days={cur.daily_errors.map((d) => d.day)} kind="bar" label="Errors per day" series={[{ name: "Errors", values: cur.daily_errors.map((d) => d.errors) }]} />
      </Panel>
      <Panel title="Most frequent errors" note="Full detail is on the Errors page.">
        <DataTable rows={cur.top_errors} empty="No errors in this period." cols={[
          { label: "Message", render: (e) => <span className="break-words">{e.message}</span> },
          { label: "Where", render: (e) => e.path ?? "-" },
          { label: "Count", align: "right", render: (e) => n(e.count) },
        ]} />
        <Link href="/admin/errors" className="mt-2 inline-block text-sm font-semibold underline" style={{ color: "var(--blue)" }}>Open Errors →</Link>
      </Panel>
    </AnalyticsShell>
  );
}
