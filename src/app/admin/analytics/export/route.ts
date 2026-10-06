import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveRange } from "@/lib/analytics/range";

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formulas in text coming from users.
  const safe = /^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const toCsv = (rows: Record<string, unknown>[]) => {
  if (rows.length === 0) return "No data\n";
  const cols = Object.keys(rows[0]);
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
};

export async function GET(req: NextRequest) {
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const r = resolveRange(sp);
  const kind = sp.kind ?? "";
  const supabase = await createClient();

  const args = { p_from: r.from.toISOString(), p_to: r.to.toISOString() };
  let rows: Record<string, unknown>[] = [];

  if (kind === "ads") {
    const { data, error } = await supabase.rpc("admin_analytics_ads", args);
    if (error) return new NextResponse("Forbidden", { status: 403 });
    rows = (data.ads as Record<string, unknown>[]).map((a) => ({
      ad: a.headline, advertiser: a.sponsor_name, placement: a.placement, status: a.status,
      starts: a.starts_at, ends: a.ends_at, impressions: a.impressions, unique_viewers: a.unique_viewers,
      clicks: a.clicks, ctr_percent: Number(a.impressions) > 0 ? ((Number(a.clicks) / Number(a.impressions)) * 100).toFixed(2) : "",
    }));
  } else if (kind === "pages") {
    const { data, error } = await supabase.rpc("admin_analytics_traffic", args);
    if (error) return new NextResponse("Forbidden", { status: 403 });
    rows = (data.top_pages as Record<string, unknown>[]).map((p) => ({ page: p.path, views: p.views, visits: p.visits }));
  } else if (kind === "bouts") {
    const { data, error } = await supabase.rpc("admin_analytics_engagement", args);
    if (error) return new NextResponse("Forbidden", { status: 403 });
    rows = (data.top_bouts as Record<string, unknown>[]).map((b) => ({
      matchup: `${b.competitor_a_name} vs ${b.competitor_b_name}`, title: b.title, status: b.status, votes: b.votes, accounts: b.accounts,
    }));
  } else if (kind === "signups") {
    const { data, error } = await supabase.rpc("admin_analytics_growth", args);
    if (error) return new NextResponse("Forbidden", { status: 403 });
    rows = (data.daily_signups as Record<string, unknown>[]).map((d) => ({ day: d.day, signups: d.signups }));
  } else {
    return new NextResponse("Unknown export", { status: 400 });
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="boutcasts-${kind}-${r.fromDay}-to-${r.toDay}.csv"`,
      "cache-control": "no-store",
    },
  });
}
