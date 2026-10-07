import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isPast } from "@/lib/analytics/range";
import { AnalyticsShell } from "@/components/analytics/ui";
import ReportLinkManager, { type ReportLink } from "@/components/analytics/ReportLinkManager";

export const metadata: Metadata = {
  title: "Advertiser report links",
  description: "Create and manage private, read-only report links and branded PDFs for advertisers.",
};

export default async function ReportLinksPage({ searchParams }: { searchParams: Promise<{ sponsor?: string }> }) {
  const { sponsor } = await searchParams;
  const supabase = await createClient();
  const [{ data: sponsors }, { data: links }] = await Promise.all([
    supabase.from("sponsors").select("id, name").order("name"),
    supabase
      .from("analytics_report_links")
      .select("id, token, sponsor_id, label, range_days, expires_at, revoked_at, view_count, last_viewed_at, created_at, sponsors(name)")
      .order("created_at", { ascending: false }),
  ]);

  const rows: ReportLink[] = (links ?? []).map((l) => {
    const sp = l.sponsors as { name: string } | { name: string }[] | null;
    return {
      id: l.id, token: l.token, sponsor_id: l.sponsor_id,
      sponsor_name: (Array.isArray(sp) ? sp[0]?.name : sp?.name) ?? "Advertiser",
      label: l.label, range_days: l.range_days, expires_at: l.expires_at, revoked_at: l.revoked_at,
      view_count: l.view_count, last_viewed_at: l.last_viewed_at, created_at: l.created_at,
      expired: l.expires_at ? isPast(l.expires_at) : false,
    };
  });

  return (
    <AnalyticsShell
      range={null}
      active="links"
      title="Advertiser report links"
      intro="Send an advertiser a private page (and branded PDF) with their ad views, clicks, placements and matchup results. No login needed; revoke any link at any time."
    >
      <ReportLinkManager sponsors={sponsors ?? []} links={rows} preselect={sponsor} />
    </AnalyticsShell>
  );
}
