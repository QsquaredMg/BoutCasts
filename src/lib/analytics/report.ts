import { createClient } from "@/lib/supabase/server";

export type SponsorReport = {
  sponsor: { id: string; name: string; logo_url: string | null; website_url: string | null };
  label: string | null;
  range_days: number | null;
  generated_at: string;
  totals: {
    bouts: number; votes: number; guest_votes: number; unique_accounts: number; shares: number; graphics: number;
    ad_impressions: number; ad_clicks: number; ad_unique_viewers: number;
  };
  bouts: { id: string; title: string; competitor_a_name: string; competitor_b_name: string; status: string; via: string; votes: number; shares: number; graphics: number }[];
  ads: { id: string; headline: string | null; placement: string; media_type: string; status: string; starts_at: string | null; ends_at: string | null; impressions: number; unique_viewers: number; clicks: number }[];
  daily: { day: string; impressions: number; clicks: number }[];
  placements: { placement: string; impressions: number; clicks: number }[];
  devices: { device: string; impressions: number }[];
};

export async function loadReportByToken(token: string): Promise<SponsorReport | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("analytics_report_by_token", { p_token: token });
  if (error || !data) return null;
  return data as SponsorReport;
}

export const PLACEMENT_LABELS: Record<string, string> = {
  interstitial: "Full-screen between votes",
  preroll: "Before clips play",
};

export function placementLabel(p: string): string {
  return PLACEMENT_LABELS[p] ?? p.replace(/[_-]/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function periodLabel(r: { range_days: number | null; generated_at: string }): string {
  const end = new Date(r.generated_at).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "America/Chicago" });
  if (!r.range_days) return `All activity through ${end}`;
  const start = new Date(new Date(r.generated_at).getTime() - r.range_days * 86_400_000).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "America/Chicago" });
  return `${start} to ${end}`;
}
